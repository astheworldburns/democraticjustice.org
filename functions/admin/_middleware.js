const SESSION_COOKIE = "__Host-dj_admin_session";
const SESSION_PREFIX = "session:";

function parseCookies(header = "") {
  const cookies = {};

  for (const part of header.split(/;\s*/)) {
    if (!part) continue;
    const splitIndex = part.indexOf("=");

    if (splitIndex < 0) {
      cookies[part] = "";
      continue;
    }

    const name = part.slice(0, splitIndex);
    const rawValue = part.slice(splitIndex + 1);

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }

  return cookies;
}

function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isLoginPath(pathname) {
  return pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/index.html";
}

function isSessionRecordValid(record = {}, now = Date.now()) {
  if (!record || typeof record !== "object") {
    return false;
  }

  if (record.active === false || record.revoked === true || record.deleted === true) {
    return false;
  }

  const expiryCandidates = [record.expiresAt, record.expires_at, record.exp, record.ttl, record.validUntil];

  for (const value of expiryCandidates) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (typeof value === "number") {
      const epochMs = value > 1e12 ? value : value * 1000;
      return epochMs > now;
    }

    if (typeof value === "string") {
      const asNumber = Number(value);
      if (!Number.isNaN(asNumber) && value.trim() !== "") {
        const epochMs = asNumber > 1e12 ? asNumber : asNumber * 1000;
        return epochMs > now;
      }

      const parsedMs = Date.parse(value);
      if (!Number.isNaN(parsedMs)) {
        return parsedMs > now;
      }
    }
  }

  return true;
}

function redirectToLogin(url) {
  const next = `${url.pathname}${url.search}`;
  return Response.redirect(`${url.origin}/admin/?next=${encodeURIComponent(next)}`, 302);
}

async function sessionExists(context, sessionId) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const storedSession = await context.env.ADMIN_SESSIONS.get(key, "json");

  if (storedSession && isSessionRecordValid(storedSession)) {
    return true;
  }

  if (storedSession && typeof storedSession !== "object") {
    return true;
  }

  return false;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!isAdminPath(url.pathname)) {
    return context.next();
  }

  if (isLoginPath(url.pathname)) {
    return context.next();
  }

  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return redirectToLogin(url);
  }

  const isValidSession = await sessionExists(context, sessionId);

  if (!isValidSession) {
    return redirectToLogin(url);
  }

  return context.next();
}
