import { SESSION_COOKIE, sanitizeNextPath } from "./config.js";
import { clearSessionCookie, createSessionCookie, parseCookies } from "./cookies.js";
import { constantTimeEquals, decodeStoredHash, pbkdf2Sha256, randomId } from "./crypto.js";
import { createGithubAuthorizeUrl, exchangeCodeForToken, fetchGithubUser } from "./github.js";
import { handleOptions, json, redirect, withCors } from "./http.js";
import { handleCmsGithubToken } from "./cms-bridge.js";
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

function getPasswordFields(user) {
  const passwordHash = user.passwordHash || user.password_hash || "";
  const passwordSalt = user.passwordSalt || user.password_salt || "";
  const passwordIterations = Number.parseInt(
    String(user.passwordIterations || user.password_iterations || user.pbkdf2Iterations || ""),
    10
  );

  return {
    passwordHash,
    passwordSalt,
    passwordIterations: Number.isFinite(passwordIterations) && passwordIterations > 0 ? passwordIterations : null
  };
}

async function authenticateWithPassword(env, email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || !password) {
    console.info("auth.login.invalid_input", { hasEmail: Boolean(normalized), hasPassword: Boolean(password) });
    return null;
  }

  const user = await env.ADMIN_USERS.get(`user:${normalized}`, "json");
  if (!user || typeof user !== "object") {
    console.info("auth.login.user_missing", { email: normalized });
    return null;
  }

  const passwordFields = getPasswordFields(user);
  const salt = decodeStoredHash(passwordFields.passwordSalt);
  const expectedHash = decodeStoredHash(passwordFields.passwordHash);

  if (!salt.length || !expectedHash.length) {
    console.info("auth.login.password_record_invalid", { email: normalized });
    return null;
  }

  const iterationCandidates = Array.from(
    new Set([passwordFields.passwordIterations, 100000, 100000].filter(Boolean))
  );

  for (const iterations of iterationCandidates) {
    const derived = await pbkdf2Sha256(password, salt, iterations, 256);
    if (constantTimeEquals(derived, expectedHash)) {
      console.info("auth.login.password_verified", { email: normalized, iterations });
      return {
        email: normalized,
        displayName: user.displayName || user.name || "",
        roles: Array.isArray(user.roles) ? user.roles : user.role ? [user.role] : []
      };
    }
  }

  console.info("auth.login.password_mismatch", { email: normalized, triedIterations: iterationCandidates.length });
  return null;
}

function sessionUser(session) {
  return {
    email: session.email,
    displayName: session.displayName || "",
    roles: Array.isArray(session.roles) ? session.roles : []
  };
}

function oauthErrorRedirect(nextPath, errorCode) {
  const params = new URLSearchParams();
  params.set("error", errorCode);
  if (nextPath) {
    params.set("next", sanitizeNextPath(nextPath));
  }
  return redirect(`/admin/?${params.toString()}`);
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await authenticateWithPassword(env, body.email, body.password);
  if (!user) {
    console.info("auth.login.failed", { email: String(body.email || "").trim().toLowerCase() });
    return unauthorized();
  }

  const { sessionId, ttl } = await createSession(env, user);
  console.info("auth.login.session_created", { email: user.email, sessionIdPrefix: sessionId.slice(0, 8), ttl });
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
  console.info("auth.github.start", { nextPath, statePrefix: state.slice(0, 8) });
  return redirect(createGithubAuthorizeUrl(env, state));
}

async function handleGithubCallback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";

  console.info("auth.github.callback_reached", {
    hasState: Boolean(state),
    hasCode: Boolean(code)
  });

  if (!state || !code) {
    return oauthErrorRedirect("", "oauth_failed");
  }

  const storedState = await consumeOauthState(env, state);
  if (!storedState || typeof storedState !== "object") {
    console.info("auth.github.invalid_state", { statePrefix: state.slice(0, 8) });
    return oauthErrorRedirect("", "invalid_state");
  }
  const nextPath = sanitizeNextPath(storedState.nextPath || "/admin/");
  console.info("auth.github.state_validated", { nextPath, statePrefix: state.slice(0, 8) });

  const token = await exchangeCodeForToken(env, code);
  if (!token) {
    console.info("auth.github.token_exchange_failed", { nextPath });
    return oauthErrorRedirect(nextPath, "oauth_failed");
  }

  const profile = await fetchGithubUser(token);
  if (!profile || !profile.id) {
    console.info("auth.github.user_fetch_failed", { nextPath });
    return oauthErrorRedirect(nextPath, "oauth_failed");
  }
  console.info("auth.github.user_found", { githubId: String(profile.id) });

  const mappedUser = await env.ADMIN_USERS.get(`user:github:${profile.id}`, "json");
  if (!mappedUser || typeof mappedUser !== "object" || !mappedUser.email) {
    console.info("auth.github.user_not_provisioned", { githubId: String(profile.id) });
    return oauthErrorRedirect(nextPath, "not_provisioned");
  }
  console.info("auth.github.user_provisioned", { githubId: String(profile.id), email: String(mappedUser.email).toLowerCase() });

  const user = {
    email: String(mappedUser.email).toLowerCase(),
    displayName: mappedUser.displayName || profile.name || profile.login || "",
    roles: Array.isArray(mappedUser.roles) ? mappedUser.roles : []
  };

  const { sessionId, ttl } = await createSession(env, user, { githubToken: token });
  console.info("auth.github.session_created", {
    email: user.email,
    githubId: String(profile.id),
    sessionIdPrefix: sessionId.slice(0, 8),
    nextPath
  });

  return redirect(nextPath, 302, {
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

  if (pathname === "/api/cms/github-token" && request.method === "GET") {
    return handleCmsGithubToken(request, env);
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
