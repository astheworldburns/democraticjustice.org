export const SESSION_COOKIE = "__Host-dj_admin_session";
const DEFAULT_SESSION_TTL = 43200;
const DEFAULT_JWT_TTL = 3600;

export function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSessionTtl(env) {
  return parseNumber(env.SESSION_TTL, DEFAULT_SESSION_TTL);
}

export function getJwtTtl(env) {
  return parseNumber(env.JWT_TTL, DEFAULT_JWT_TTL);
}

export function splitCsv(value = "") {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function allowedOrigin(origin, env) {
  if (!origin) {
    return "";
  }

  const allowed = splitCsv(env.ALLOWED_ORIGINS || "");
  return allowed.includes(origin) ? origin : "";
}

export function sanitizeNextPath(value) {
  if (!value || !value.startsWith("/admin/")) {
    return "/admin/";
  }

  return value;
}
