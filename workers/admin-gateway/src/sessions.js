import { SESSION_COOKIE, getSessionTtl } from "./config.js";
import { parseCookies } from "./cookies.js";
import { randomId } from "./crypto.js";

const SESSION_PREFIX = "session:";
const OAUTH_STATE_PREFIX = "oauth_state:";

function sessionKey(sessionId) {
  return `${SESSION_PREFIX}${sessionId}`;
}

function stateKey(state) {
  return `${OAUTH_STATE_PREFIX}${state}`;
}

export async function createSession(env, user, extras = {}) {
  const sessionId = randomId(24);
  const ttl = getSessionTtl(env);
  const session = {
    sessionId,
    email: user.email,
    displayName: user.displayName || "",
    roles: Array.isArray(user.roles) ? user.roles : [],
    githubToken: extras.githubToken || "",
    createdAt: new Date().toISOString()
  };

  await env.ADMIN_SESSIONS.put(sessionKey(sessionId), JSON.stringify(session), {
    expirationTtl: ttl
  });

  return { sessionId, session, ttl };
}

export async function loadSessionFromRequest(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const stored = await env.ADMIN_SESSIONS.get(sessionKey(sessionId), "json");
  if (!stored || typeof stored !== "object") {
    return null;
  }

  return { sessionId, session: stored };
}

export async function destroySession(sessionId, env) {
  if (!sessionId) {
    return;
  }

  await env.ADMIN_SESSIONS.delete(sessionKey(sessionId));
}

export async function putOauthState(env, state, nextPath) {
  await env.ADMIN_SESSIONS.put(
    stateKey(state),
    JSON.stringify({ nextPath }),
    { expirationTtl: 600 }
  );
}

export async function consumeOauthState(env, state) {
  const key = stateKey(state);
  const payload = await env.ADMIN_SESSIONS.get(key, "json");
  await env.ADMIN_SESSIONS.delete(key);
  return payload;
}
