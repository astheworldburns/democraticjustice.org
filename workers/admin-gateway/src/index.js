import { SESSION_COOKIE, getJwtTtl, sanitizeNextPath } from "./config.js";
import { clearSessionCookie, createSessionCookie, parseCookies } from "./cookies.js";
import { constantTimeEquals, decodeStoredHash, pbkdf2Sha256, randomId } from "./crypto.js";
import { createGithubAuthorizeUrl, exchangeCodeForToken, fetchGithubUser } from "./github.js";
import { handleOptions, json, redirect, withCors } from "./http.js";
import { signHs256 } from "./jwt.js";
import {
  consumeOauthState,
  createSession,
  destroySession,
  loadSessionFromRequest,
  putOauthState
} from "./sessions.js";

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

async function authenticateWithPassword(env, email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !password) {
    return null;
  }

  const user = await env.ADMIN_USERS.get(`user:${normalized}`, "json");
  if (!user || typeof user !== "object") {
    return null;
  }

  const salt = decodeStoredHash(user.passwordSalt || "");
  const expectedHash = decodeStoredHash(user.passwordHash || "");

  if (!salt.length || !expectedHash.length) {
    return null;
  }

  const derived = await pbkdf2Sha256(password, salt, 210000, 256);
  if (!constantTimeEquals(derived, expectedHash)) {
    return null;
  }

  return {
    email: normalized,
    displayName: user.displayName || "",
    roles: Array.isArray(user.roles) ? user.roles : []
  };
}

function sessionUser(session) {
  return {
    email: session.email,
    displayName: session.displayName || "",
    roles: Array.isArray(session.roles) ? session.roles : []
  };
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await authenticateWithPassword(env, body.email, body.password);
  if (!user) {
    return unauthorized();
  }

  const { sessionId, ttl } = await createSession(env, user);
  return json(
    { ok: true, user },
    {
      headers: {
        "Set-Cookie": createSessionCookie(sessionId, ttl)
      }
    }
  );
}

async function handleGithubStart(request, env) {
  const url = new URL(request.url);
  const nextPath = sanitizeNextPath(url.searchParams.get("next") || "");
  const state = randomId(18);

  await putOauthState(env, state, nextPath);
  return redirect(createGithubAuthorizeUrl(env, state));
}

async function handleGithubCallback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";

  if (!state || !code) {
    return redirect("/admin/?error=oauth_failed");
  }

  const storedState = await consumeOauthState(env, state);
  if (!storedState || typeof storedState !== "object") {
    return redirect("/admin/?error=invalid_state");
  }

  const token = await exchangeCodeForToken(env, code);
  if (!token) {
    return redirect("/admin/?error=oauth_failed");
  }

  const profile = await fetchGithubUser(token);
  if (!profile || !profile.id) {
    return redirect("/admin/?error=oauth_failed");
  }

  const mappedUser = await env.ADMIN_USERS.get(`user:github:${profile.id}`, "json");
  if (!mappedUser || typeof mappedUser !== "object" || !mappedUser.email) {
    return redirect("/admin/?error=not_provisioned");
  }

  const user = {
    email: String(mappedUser.email).toLowerCase(),
    displayName: mappedUser.displayName || profile.name || profile.login || "",
    roles: Array.isArray(mappedUser.roles) ? mappedUser.roles : []
  };

  const { sessionId, ttl } = await createSession(env, user, { githubToken: token });
  return redirect(sanitizeNextPath(storedState.nextPath || "/admin/"), 302, {
    "Set-Cookie": createSessionCookie(sessionId, ttl)
  });
}

async function handleSession(request, env) {
  const loaded = await loadSessionFromRequest(request, env);
  if (!loaded) {
    return unauthorized();
  }

  return json({ authenticated: true, user: sessionUser(loaded.session) });
}

async function handleLogout(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  await destroySession(cookies[SESSION_COOKIE], env);
  return json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}

async function handleCmsAutoToken(request, env) {
  const loaded = await loadSessionFromRequest(request, env);
  if (!loaded) {
    return unauthorized();
  }

  const ttl = getJwtTtl(env);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: loaded.session.email,
    email: loaded.session.email,
    roles: Array.isArray(loaded.session.roles) ? loaded.session.roles : [],
    iat: now,
    exp: now + ttl
  };

  const accessToken = await signHs256(payload, env.JWT_SECRET);
  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ttl
  });
}

function forwardToService(request, service, pathname, mutateHeaders) {
  const url = new URL(request.url);
  url.pathname = pathname;

  const headers = new Headers(request.headers);
  mutateHeaders?.(headers);

  const downstream = new Request(url.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual"
  });

  return service.fetch(downstream);
}

async function handleProtectedProofProxy(request, env) {
  const loaded = await loadSessionFromRequest(request, env);
  if (!loaded) {
    return unauthorized();
  }

  return forwardToService(request, env.PROOF_GATEWAY, new URL(request.url).pathname, (headers) => {
    headers.set("X-Internal-Secret", env.INTERNAL_SECRET);
    headers.set("X-User-Email", loaded.session.email || "");
    headers.set("X-User-Roles", JSON.stringify(loaded.session.roles || []));
    if (loaded.session.githubToken) {
      headers.set("X-GitHub-Token", loaded.session.githubToken);
    } else {
      headers.delete("X-GitHub-Token");
    }
  });
}

async function handleCmsProxy(request, env) {
  const url = new URL(request.url);
  const strippedPath = url.pathname.replace(/^\/api\/cms/, "") || "/";
  return forwardToService(request, env.CMS_GATEWAY, strippedPath);
}

async function route(request, env) {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return handleOptions(request, env);
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (pathname === "/api/auth/github" && request.method === "GET") {
    return handleGithubStart(request, env);
  }

  if (pathname === "/api/auth/github/callback" && request.method === "GET") {
    return handleGithubCallback(request, env);
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    return handleSession(request, env);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return handleLogout(request, env);
  }

  if (pathname === "/api/cms/identity/auto-token") {
    return handleCmsAutoToken(request, env);
  }

  if (pathname.startsWith("/api/editor/") || pathname.startsWith("/api/proof/")) {
    return handleProtectedProofProxy(request, env);
  }

  if (pathname.startsWith("/api/cms/")) {
    return handleCmsProxy(request, env);
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const response = await route(request, env).catch((error) => {
      console.error("admin-gateway error", error);
      return json({ error: "Internal Server Error" }, { status: 500 });
    });

    return withCors(request, response, env);
  }
};
