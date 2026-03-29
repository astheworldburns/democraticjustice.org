const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  return fromBase64(padded).buffer;
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!origin || !allowed.includes(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(status, data, corsHeaders = null, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
    ...(corsHeaders || {}),
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function handleOptions(request, env) {
  const origin = request.headers.get("Origin");
  const corsHeaders = cors(origin, env);

  if (!corsHeaders) {
    return jsonResponse(403, { error: "forbidden" });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function importHmacKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importHmacKey(secret, "sign");
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  const signature = base64url(sigBuffer);

  return `${signingInput}.${signature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(decoder.decode(new Uint8Array(base64urlDecode(headerB64))));
    if (!header || header.alg !== "HS256" || header.typ !== "JWT") return null;

    const key = await importHmacKey(secret, "verify");
    const signingInput = `${headerB64}.${payloadB64}`;
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(base64urlDecode(sigB64)),
      encoder.encode(signingInput)
    );

    if (!ok) return null;

    const payload = JSON.parse(decoder.decode(new Uint8Array(base64urlDecode(payloadB64))));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    material,
    256
  );
  return toBase64(new Uint8Array(bits));
}

async function verifyPassword(password, storedHash, storedSalt) {
  try {
    const salt = fromBase64(storedSalt);
    const computed = await hashPassword(password, salt);
    return computed === storedHash;
  } catch {
    return false;
  }
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getBearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function loadUserByEmail(env, email) {
  const key = `user:${email.toLowerCase()}`;
  const raw = await env.CMS_USERS.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeUserResponse(user, email) {
  return {
    id: user.id,
    email,
    app_metadata: { provider: "email", roles: [user.role] },
    user_metadata: { full_name: user.name || "" },
  };
}

async function handleIdentityToken(request, env, corsHeaders) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const grantType = params.get("grant_type");

  if (grantType === "password") {
    const emailRaw = params.get("username") || "";
    const password = params.get("password") || "";
    const email = emailRaw.trim().toLowerCase();

    const user = await loadUserByEmail(env, email);
    const valid = user && (await verifyPassword(password, user.password_hash, user.password_salt));

    if (!valid) {
      return jsonResponse(
        401,
        { error: "invalid_grant", error_description: "Invalid email or password" },
        corsHeaders
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = await signJWT(
      {
        sub: user.id,
        email,
        role: user.role,
        exp: now + 3600,
        iat: now,
      },
      env.JWT_SECRET
    );
    const refreshToken = randomHex(32);
    await env.CMS_USERS.put(`refresh:${refreshToken}`, email, { expirationTtl: 604800 });

    return jsonResponse(
      200,
      {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        user: makeUserResponse(user, email),
      },
      corsHeaders
    );
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token") || "";
    const key = `refresh:${refreshToken}`;
    const email = await env.CMS_USERS.get(key);

    if (!email) {
      return jsonResponse(
        401,
        { error: "invalid_grant", error_description: "Invalid refresh token" },
        corsHeaders
      );
    }

    await env.CMS_USERS.delete(key);
    const user = await loadUserByEmail(env, email);
    if (!user) {
      return jsonResponse(
        401,
        { error: "invalid_grant", error_description: "Invalid refresh token" },
        corsHeaders
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = await signJWT(
      {
        sub: user.id,
        email,
        role: user.role,
        exp: now + 3600,
        iat: now,
      },
      env.JWT_SECRET
    );
    const newRefreshToken = randomHex(32);
    await env.CMS_USERS.put(`refresh:${newRefreshToken}`, email, { expirationTtl: 604800 });

    return jsonResponse(
      200,
      {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: newRefreshToken,
        user: makeUserResponse(user, email),
      },
      corsHeaders
    );
  }

  return jsonResponse(
    400,
    { error: "unsupported_grant_type", error_description: "Unsupported grant_type" },
    corsHeaders
  );
}

async function handleIdentityUser(request, env, corsHeaders) {
  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse(401, { error: "unauthorized" }, corsHeaders);
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse(401, { error: "unauthorized" }, corsHeaders);
  }

  const user = await loadUserByEmail(env, payload.email);
  return jsonResponse(
    200,
    {
      id: payload.sub,
      email: payload.email,
      app_metadata: { provider: "email", roles: [payload.role] },
      user_metadata: { full_name: user?.name || "" },
    },
    corsHeaders
  );
}

async function handleGitProxy(request, env, corsHeaders, pathname) {
  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse(401, { error: "unauthorized" }, corsHeaders);
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse(401, { error: "unauthorized" }, corsHeaders);
  }

  const suffix = pathname.replace(/^\/git\/github\//, "");
  if (!suffix) {
    return jsonResponse(404, { error: "not_found" }, corsHeaders);
  }

  const url = new URL(request.url);
  const githubUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/${suffix}${url.search}`;

  const headers = new Headers();
  headers.set("Authorization", `token ${env.GITHUB_PAT}`);
  headers.set("User-Agent", "cms-gateway");
  headers.set("Accept", request.headers.get("Accept") || "application/vnd.github.v3+json");

  const contentType = request.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const init = {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method.toUpperCase()) ? undefined : request.body,
  };

  const upstream = await fetch(githubUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    responseHeaders.set(k, v);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

async function handleAdminCreateUser(request, env, corsHeaders) {
  const token = getBearerToken(request);
  if (!token || token !== env.SETUP_SECRET) {
    return jsonResponse(401, { error: "unauthorized" }, corsHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "invalid_request", message: "Body must be valid JSON" }, corsHeaders);
  }

  const { email, name, password, role } = body || {};
  if (!email || !name || !password || !role) {
    return jsonResponse(
      400,
      { error: "invalid_request", message: "Missing required fields: email, name, password, role" },
      corsHeaders
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const passwordHash = await hashPassword(password, salt);
  const id = crypto.randomUUID();

  await env.CMS_USERS.put(
    `user:${normalizedEmail}`,
    JSON.stringify({
      id,
      name,
      role,
      password_hash: passwordHash,
      password_salt: toBase64(salt),
    })
  );

  return jsonResponse(201, { ok: true, email: normalizedEmail, id }, corsHeaders);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const path = new URL(request.url).pathname;

    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    if (origin) {
      const allowed = cors(origin, env);
      if (!allowed) {
        return jsonResponse(403, { error: "forbidden" });
      }
    }

    const corsHeaders = origin ? cors(origin, env) : {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };

    try {
      if (path === "/health" && request.method === "GET") {
        return jsonResponse(200, { status: "ok", service: "cms-gateway" }, corsHeaders);
      }

      if (path === "/admin/create-user" && request.method === "POST") {
        return await handleAdminCreateUser(request, env, corsHeaders);
      }

      if (path === "/identity/token" && request.method === "POST") {
        return await handleIdentityToken(request, env, corsHeaders);
      }

      if (path === "/identity/user" && request.method === "GET") {
        return await handleIdentityUser(request, env, corsHeaders);
      }

      if (path.startsWith("/git/github/")) {
        return await handleGitProxy(request, env, corsHeaders, path);
      }

      return jsonResponse(404, { error: "not_found" }, corsHeaders);
    } catch (error) {
      console.error("cms-gateway error", error);
      return jsonResponse(500, { error: "internal_server_error" }, corsHeaders);
    }
  },
};
