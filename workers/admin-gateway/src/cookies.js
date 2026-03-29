import { SESSION_COOKIE } from "./config.js";

export function parseCookies(header = "") {
  const entries = header
    .split(/;\s*/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx < 0) {
        return [pair, ""];
      }
      return [pair.slice(0, idx), decodeURIComponent(pair.slice(idx + 1))];
    });

  return Object.fromEntries(entries);
}

export function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.secure !== false) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createSessionCookie(sessionId, maxAge) {
  return buildCookie(SESSION_COOKIE, sessionId, {
    maxAge,
    path: "/",
    sameSite: "Lax",
    httpOnly: true,
    secure: true
  });
}

export function clearSessionCookie() {
  return buildCookie(SESSION_COOKIE, "deleted", {
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    httpOnly: true,
    secure: true
  });
}
