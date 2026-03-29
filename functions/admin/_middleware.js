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
    const value = part.slice(splitIndex + 1);

    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

function isLoginPath(pathname) {
  return pathname === "/admin/" || pathname === "/admin/index.html";
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!url.pathname.startsWith("/admin/")) {
    return context.next();
  }

  if (isLoginPath(url.pathname)) {
    return context.next();
  }

  const cookies = parseCookies(context.request.headers.get("Cookie") || "");
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return Response.redirect(
      `${url.origin}/admin/?next=${encodeURIComponent(url.pathname + url.search)}`,
      302
    );
  }

  const key = `${SESSION_PREFIX}${sessionId}`;
  const storedSession = await context.env.ADMIN_SESSIONS.get(key);

  if (!storedSession) {
    return Response.redirect(
      `${url.origin}/admin/?next=${encodeURIComponent(url.pathname + url.search)}`,
      302
    );
  }

  return context.next();
}
