import yaml from "js-yaml";

const SESSION_COOKIE = "__Host-dj_proof_session";
const PROOF_STATE_COOKIE = "__Host-dj_proof_state";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const EDITOR_SESSION_COOKIE = "__Host-dj_editor_session";
const EDITOR_SESSION_TTL_SECONDS = 60 * 60 * 12;
const CMS_CSRF_COOKIE = "__Host-dj_cms_csrf";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);
const EDITOR_SESSION_KEY_PREFIX = "editor_session:";
const EDITOR_USER_KEY_PREFIX = "editor_user:";
const EDITOR_LOGIN_RATE_KEY_PREFIX = "editor_login_rate:";
const EDITOR_ROLES = new Set(["writer", "editor", "publisher", "admin"]);
const EDITOR_LOGIN_WINDOW_SECONDS = 15 * 60;
const EDITOR_LOGIN_MAX_ATTEMPTS = 5;
const EDITOR_LOGIN_BLOCK_SECONDS = 15 * 60;
const internalProofSessions = new WeakMap();
const internalEditorSessions = new WeakMap();

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

function text(message, status = 200, headers = {}) {
  return new Response(message, {
    status,
    headers
  });
}

function workerCsp(response) {
  const contentType = response.headers.get("Content-Type") || "";

  if (contentType.includes("text/html")) {
    return "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
  }

  return "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
}

function finalizeWorkerResponse(response) {
  const headers = new Headers(response.headers);

  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Content-Security-Policy", workerCsp(response));
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), ambient-light-sensor=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), usb=(), xr-spatial-tracking=()"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function splitList(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAllowedDomain(hostname = "", patterns = []) {
  if (!patterns.length) {
    return true;
  }

  return patterns.some((pattern) =>
    hostname.match(new RegExp(`^${escapeRegExp(pattern).replace("\\*", ".+")}$`))
  );
}

function sanitizeNextUrl(value = "", env) {
  const allowedOrigins = splitList(env.ALLOWED_ORIGINS || "");
  const fallback = `${allowedOrigins[0] || ""}/admin/proof/`;

  if (!value) {
    return fallback;
  }

  try {
    const nextUrl = new URL(value);
    return allowedOrigins.includes(nextUrl.origin) ? nextUrl.toString() : fallback;
  } catch {
    return fallback;
  }
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = splitList(env.ALLOWED_ORIGINS || "");

  if (!origin) {
    return "";
  }

  return allowedOrigins.includes(origin) ? origin : "";
}

function withCors(request, response, env) {
  const origin = allowedOrigin(request, env);

  if (!origin) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function handleOptions(request, env) {
  const origin = allowedOrigin(request, env);

  if (!origin) {
    return new Response("", { status: 403 });
  }

  return new Response("", {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin"
    }
  });
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(/;\s*/)
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        if (index === -1) {
          return [pair, ""];
        }
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      })
  );
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push(`Path=${options.path || "/"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  } else {
    parts.push("SameSite=None");
  }

  if (options.secure !== false) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearCookie(name, options = {}) {
  return cookie(name, "deleted", {
    ...options,
    maxAge: 0
  });
}

function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return true;
  }
}

function normalizeWhitespace(value = "") {
  return value
    .toString()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pathBasename(repoPath = "") {
  return repoPath.split("/").pop() || "";
}

function pathStem(repoPath = "") {
  return pathBasename(repoPath).replace(/\.[^.]+$/, "");
}

function sortArticles(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return rightTime - leftTime || left.title.localeCompare(right.title);
  });
}

function sortDocuments(items = []) {
  return [...items].sort((left, right) => left.title.localeCompare(right.title));
}

function parseFrontmatter(rawContent = "") {
  const match = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error("The selected file does not have YAML frontmatter.");
  }

  return {
    data: yaml.load(match[1]) || {},
    body: match[2] || ""
  };
}

function stringifyFrontmatter(data = {}, body = "") {
  const frontmatter = yaml.dump(data, {
    lineWidth: 1000,
    noRefs: true,
    sortKeys: false
  });

  return `---\n${frontmatter}---\n${body.replace(/^\n*/, "")}`;
}

function base64ToUtf8(value = "") {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeBase64ToUint8Array(value = "") {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function cmsAuthHtml({ provider = "github", token, error, errorCode, origin = "*", secure = true }) {
  const state = error ? "error" : "success";
  const content = error ? { provider, error, errorCode } : { provider, token };
  const providerLiteral = JSON.stringify(provider);
  const stateLiteral = JSON.stringify(state);
  const payloadLiteral = JSON.stringify(JSON.stringify(content));
  const targetOriginLiteral = JSON.stringify(origin || "*");
  const allowAnyOriginLiteral = JSON.stringify(!origin || origin === "*");

  return new Response(
    `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        const targetOrigin = ${targetOriginLiteral};
        const allowAnyOrigin = ${allowAnyOriginLiteral};

        function receiveMessage(event) {
          if (!allowAnyOrigin && event.origin !== targetOrigin) {
            return;
          }
          if (event.data !== "authorizing:" + ${providerLiteral}) {
            return;
          }
          window.opener.postMessage(
            "authorization:" + ${providerLiteral} + ":" + ${stateLiteral} + ":" + ${payloadLiteral},
            allowAnyOrigin ? event.origin : targetOrigin
          );
        }

        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:" + ${providerLiteral}, targetOrigin);
      })();
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": clearCookie(CMS_CSRF_COOKIE, {
          secure,
          sameSite: "Lax"
        })
      }
    }
  );
}

function requestOrigin(request) {
  const origin = request.headers.get("Origin") || "";

  if (origin) {
    return origin;
  }

  const referer = request.headers.get("Referer") || "";

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function validatedCmsOrigin(request, env) {
  const candidate = requestOrigin(request);
  const allowedOrigins = splitList(env.ALLOWED_ORIGINS || "");

  if (!candidate) {
    return "";
  }

  return allowedOrigins.includes(candidate) ? candidate : "";
}

async function githubTokenExchange(requestUrl, code, env) {
  const tokenResponse = await fetch(`https://${env.GITHUB_HOSTNAME || "github.com"}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": env.GITHUB_USER_AGENT || "democraticjustice-proof-desk"
    },
    body: JSON.stringify({
      code,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      redirect_uri: `${requestUrl.origin}/callback`
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange the GitHub authorization code.");
  }

  const payload = await tokenResponse.json();

  if (!payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GitHub did not return an access token.");
  }

  return payload.access_token;
}

async function githubRequest(pathname, token, env, options = {}) {
  const response = await fetch(`https://api.${env.GITHUB_HOSTNAME || "github.com"}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": env.GITHUB_USER_AGENT || "democraticjustice-proof-desk",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub request failed (${response.status}).`);
  }

  return response;
}

async function githubJson(pathname, token, env, options = {}) {
  const response = await githubRequest(pathname, token, env, options);
  return response.json();
}

async function fetchViewer(token, env) {
  return githubJson("/user", token, env);
}

async function verifyUserAllowed(user, token, env) {
  const allowedUsers = splitList(env.GITHUB_ALLOWED_USERS || "");

  if (allowedUsers.length && !allowedUsers.includes(user.login)) {
    throw new Error("That GitHub user is not allowed to use the Proof Desk.");
  }

  if (env.GITHUB_ALLOWED_ORG) {
    const response = await fetch(
      `https://api.${env.GITHUB_HOSTNAME || "github.com"}/user/memberships/orgs/${encodeURIComponent(env.GITHUB_ALLOWED_ORG)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": env.GITHUB_USER_AGENT || "democraticjustice-proof-desk",
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("That GitHub user is not a member of the allowed organization.");
    }
  }
}

async function createSession(user, token, env) {
  const sessionId = crypto.randomUUID().replaceAll("-", "");
  await env.EDITOR_SESSIONS.put(
    sessionId,
    JSON.stringify({
      login: user.login,
      name: user.name || "",
      avatar_url: user.avatar_url || "",
      github_token: token
    }),
    {
      expirationTtl: SESSION_TTL_SECONDS
    }
  );
  return sessionId;
}

async function readSession(request, env) {
  const internalSession = internalProofSessions.get(request);
  if (internalSession) {
    return internalSession;
  }

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return null;
  }

  const raw = await env.EDITOR_SESSIONS.get(sessionId);
  if (!raw) {
    return null;
  }

  return {
    id: sessionId,
    ...JSON.parse(raw)
  };
}

async function requireSession(request, env) {
  const session = await readSession(request, env);

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

function proofLoginRedirect(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secure = isSecureRequest(request);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return text("Proof Desk login is not configured yet. Missing GitHub OAuth client settings.", 500);
  }

  const csrfToken = crypto.randomUUID().replaceAll("-", "");
  const next = sanitizeNextUrl(url.searchParams.get("next") || "", env);
  const authUrl = new URL(`https://${env.GITHUB_HOSTNAME || "github.com"}/login/oauth/authorize`);

  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", `proof_${csrfToken}`);
  authUrl.searchParams.set("redirect_uri", `${origin}/callback`);

  return new Response("", {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": cookie(PROOF_STATE_COOKIE, JSON.stringify({ csrfToken, next }), {
        maxAge: 600,
        secure,
        sameSite: "Lax"
      })
    }
  });
}

function cmsAuthRedirect(request, env) {
  const url = new URL(request.url);
  const origin = url.origin;
  const secure = isSecureRequest(request);
  const provider = url.searchParams.get("provider");
  const domain = url.searchParams.get("site_id") || "";
  const allowedDomains = splitList(env.ALLOWED_DOMAINS || "");
  const cmsOrigin = validatedCmsOrigin(request, env);

  if (provider !== "github") {
    return cmsAuthHtml({
      error: "Your Git backend is not supported by the authenticator.",
      errorCode: "UNSUPPORTED_BACKEND",
      origin: cmsOrigin || "*",
      secure
    });
  }

  if (allowedDomains.length && !isAllowedDomain(domain, allowedDomains)) {
    return cmsAuthHtml({
      provider,
      error: "Your domain is not allowed to use the authenticator.",
      errorCode: "UNSUPPORTED_DOMAIN",
      origin: cmsOrigin || "*",
      secure
    });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return cmsAuthHtml({
      provider,
      error: "OAuth app client ID or secret is not configured.",
      errorCode: "MISCONFIGURED_CLIENT",
      origin: cmsOrigin || "*",
      secure
    });
  }

  if (!cmsOrigin) {
    return cmsAuthHtml({
      provider,
      error: "Your origin is not allowed to use the authenticator.",
      errorCode: "UNSUPPORTED_ORIGIN",
      origin: "*",
      secure
    });
  }

  const csrfToken = crypto.randomUUID().replaceAll("-", "");
  const authUrl = new URL(`https://${env.GITHUB_HOSTNAME || "github.com"}/login/oauth/authorize`);
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("scope", "repo,user");
  authUrl.searchParams.set("state", csrfToken);
  authUrl.searchParams.set("redirect_uri", `${origin}/callback`);

  return new Response("", {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": cookie(
        CMS_CSRF_COOKIE,
        JSON.stringify({
          provider,
          csrfToken,
          origin: cmsOrigin
        }),
        {
          maxAge: 600,
          secure,
          sameSite: "Lax"
        }
      )
    }
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const secure = isSecureRequest(request);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookies = parseCookies(request.headers.get("Cookie") || "");

  if (!code || !state) {
    return text("Missing OAuth callback parameters.", 400);
  }

  const proofStateRaw = cookies[PROOF_STATE_COOKIE];
  if (proofStateRaw) {
    try {
      const { csrfToken, next } = JSON.parse(proofStateRaw);

      if (state === `proof_${csrfToken}`) {
        const token = await githubTokenExchange(url, code, env);
        const user = await fetchViewer(token, env);
        await verifyUserAllowed(user, token, env);
        const sessionId = await createSession(user, token, env);

        return new Response("", {
          status: 302,
          headers: (() => {
            const headers = new Headers({
              Location: next || `${splitList(env.ALLOWED_ORIGINS || "")[0] || ""}/admin/proof/`
            });
            headers.append("Set-Cookie", clearCookie(PROOF_STATE_COOKIE, { secure, sameSite: "Lax" }));
            headers.append(
              "Set-Cookie",
              cookie(SESSION_COOKIE, sessionId, {
                maxAge: SESSION_TTL_SECONDS,
                secure,
                sameSite: "None"
              })
            );
            return headers;
          })()
        });
      }
    } catch (error) {
      return text(error.message || "Could not complete Proof Desk login.", 401);
    }
  }

  let cmsState = null;

  try {
    cmsState = cookies[CMS_CSRF_COOKIE] ? JSON.parse(cookies[CMS_CSRF_COOKIE]) : null;
  } catch {
    cmsState = null;
  }

  if (!cmsState || cmsState.provider !== "github" || cmsState.csrfToken !== state) {
    return cmsAuthHtml({
      provider: "github",
      error: "Potential CSRF attack detected. Authentication flow aborted.",
      errorCode: "CSRF_DETECTED",
      origin: "*",
      secure
    });
  }

  try {
    const token = await githubTokenExchange(url, code, env);
    return cmsAuthHtml({
      provider: "github",
      token,
      origin: cmsState.origin || "*",
      secure
    });
  } catch (error) {
    return cmsAuthHtml({
      provider: "github",
      error: error.message || "Failed to request an access token.",
      errorCode: "TOKEN_REQUEST_FAILED",
      origin: cmsState.origin || "*",
      secure
    });
  }
}

function isWebUrl(value = "") {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceUrl(value = "") {
  const trimmed = normalizeWhitespace(value);

  if (/^\/documents\/[a-z0-9-]+\/$/i.test(trimmed)) {
    return trimmed;
  }

  if (isWebUrl(trimmed)) {
    return trimmed;
  }

  return "";
}

function dedupeProofSources(entries = []) {
  const seen = new Set();
  const next = [];

  for (const entry of entries) {
    const documentUrl =
      typeof entry === "string"
        ? normalizeSourceUrl(entry)
        : normalizeSourceUrl(entry?.document_url || entry?.documentUrl || "");

    if (!documentUrl || seen.has(documentUrl)) {
      continue;
    }

    seen.add(documentUrl);
    next.push({ document_url: documentUrl });
  }

  return next;
}

function normalizeProofPayload(rawProof = {}) {
  const proof = rawProof && typeof rawProof === "object" ? rawProof : {};
  const axioms = Array.isArray(proof.axioms)
    ? proof.axioms.map((axiom) => ({
        premise: normalizeWhitespace(axiom?.premise || ""),
        no_source_needed: Boolean(axiom?.no_source_needed),
        sources: dedupeProofSources(axiom?.sources || [])
      }))
    : [];
  const logic = Array.isArray(proof.logic)
    ? proof.logic.map((entry) => ({
        step: normalizeWhitespace(entry?.step || "")
      }))
    : [];

  const next = {
    issue: normalizeWhitespace(proof.issue || ""),
    axioms,
    logic,
    conclusion: normalizeWhitespace(proof.conclusion || "")
  };

  if (normalizeWhitespace(proof.inference || "")) {
    next.inference = normalizeWhitespace(proof.inference);
  }

  return next;
}

function computeProofValidationErrors(proof = {}, documents = []) {
  const errors = [];
  const knownDocumentUrls = new Set((documents || []).map((document) => document.url));

  if (!proof.issue) {
    errors.push("Issue is required.");
  }

  if (!Array.isArray(proof.axioms) || proof.axioms.length === 0) {
    errors.push("At least one axiom is required.");
  } else {
    proof.axioms.forEach((axiom, index) => {
      if (!axiom.premise) {
        errors.push(`Axiom ${index + 1} needs a premise.`);
      }

      const sourceCount = Array.isArray(axiom.sources) ? axiom.sources.length : 0;

      if (axiom.no_source_needed && sourceCount > 0) {
        errors.push(`Axiom ${index + 1} cannot be source-free and source-backed at the same time.`);
      }

      if (!axiom.no_source_needed && sourceCount === 0) {
        errors.push(`Axiom ${index + 1} needs at least one linked source or a no-source flag.`);
      }

      for (const source of axiom.sources || []) {
        if (!source?.document_url) {
          continue;
        }

        if (!knownDocumentUrls.has(source.document_url) && !isWebUrl(source.document_url)) {
          errors.push(`Axiom ${index + 1} links to a missing source document: ${source.document_url}`);
        }
      }
    });
  }

  if (!Array.isArray(proof.logic) || proof.logic.length === 0) {
    errors.push("At least one inference is required.");
  } else {
    proof.logic.forEach((entry, index) => {
      if (!entry.step) {
        errors.push(`Inference ${index + 1} needs text.`);
      }
    });
  }

  if (!proof.conclusion) {
    errors.push("Conclusion is required.");
  }

  return errors;
}

function ensureAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";

  if (!origin) {
    return;
  }

  const allowedOrigins = splitList(env.ALLOWED_ORIGINS || "");
  if (!allowedOrigins.includes(origin)) {
    throw new Error("FORBIDDEN_ORIGIN");
  }
}

async function readRepoFile(repoPath, token, env) {
  const response = await githubJson(
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${repoPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}?ref=${encodeURIComponent(env.GITHUB_BRANCH || "main")}`,
    token,
    env
  );

  return {
    sha: response.sha,
    content: base64ToUtf8(response.content || "")
  };
}

async function writeRepoTextFile(repoPath, textValue, message, sha, token, env) {
  await githubJson(
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${repoPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`,
    token,
    env,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        branch: env.GITHUB_BRANCH || "main",
        sha,
        content: utf8ToBase64(textValue)
      })
    }
  );
}

async function writeRepoBinaryFile(repoPath, bytes, message, token, env) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  await githubJson(
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${repoPath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`,
    token,
    env,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        branch: env.GITHUB_BRANCH || "main",
        content: btoa(binary)
      })
    }
  );
}

async function loadRepoTree(prefix, token, env) {
  const response = await githubJson(
    `/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/git/trees/${encodeURIComponent(env.GITHUB_BRANCH || "main")}?recursive=1`,
    token,
    env
  );

  return (Array.isArray(response.tree) ? response.tree : []).filter(
    (entry) =>
      entry?.type === "blob" &&
      entry?.path?.startsWith(prefix) &&
      entry.path.endsWith(".md")
  );
}

async function loadArticles(token, env) {
  const entries = await loadRepoTree(env.ARTICLE_CONTENT_PATH || "src/content/articles/", token, env);
  const articles = await Promise.all(
    entries.map(async (entry) => {
      const { content } = await readRepoFile(entry.path, token, env);
      const parsed = parseFrontmatter(content);
      const slug = pathStem(entry.path);

      return {
        slug,
        title: parsed.data?.title || slug,
        description: parsed.data?.description || "",
        author: parsed.data?.author || "",
        date: parsed.data?.date || null,
        url: `/articles/${slug}/`,
        repo_path: entry.path,
        proof: parsed.data?.proof || null
      };
    })
  );

  return sortArticles(articles);
}

async function loadAuthors(token, env) {
  const entries = await loadRepoTree(env.AUTHOR_CONTENT_PATH || "src/content/authors/", token, env);
  const authors = await Promise.all(
    entries.map(async (entry) => {
      const { content } = await readRepoFile(entry.path, token, env);
      const parsed = parseFrontmatter(content);
      const slug = pathStem(entry.path);

      return {
        slug,
        name: parsed.data?.name || slug,
        role: parsed.data?.role || "",
        email: parsed.data?.email || "",
        repo_path: entry.path
      };
    })
  );

  return [...authors].sort((left, right) => left.name.localeCompare(right.name));
}

async function loadDocuments(token, env) {
  const entries = await loadRepoTree(env.DOCUMENT_CONTENT_PATH || "src/content/documents/", token, env);
  const documents = await Promise.all(
    entries.map(async (entry) => {
      const { content } = await readRepoFile(entry.path, token, env);
      const parsed = parseFrontmatter(content);
      const slug = pathStem(entry.path);

      return {
        slug,
        title: parsed.data?.title || slug,
        description: parsed.data?.description || "",
        obtained: parsed.data?.obtained || "",
        source_method: parsed.data?.source_method || "",
        primary_source: parsed.data?.primary_source !== false,
        url: `/documents/${slug}/`,
        file_url: parsed.data?.file || "",
        repo_path: entry.path
      };
    })
  );

  return sortDocuments(documents);
}

function normalizeEmail(value = "") {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeEditorRole(value = "writer") {
  const role = normalizeWhitespace(value).toLowerCase();
  return EDITOR_ROLES.has(role) ? role : "writer";
}

function editorSessionKey(sessionId = "") {
  return `${EDITOR_SESSION_KEY_PREFIX}${sessionId}`;
}

function editorUserKey(email = "") {
  return `${EDITOR_USER_KEY_PREFIX}${normalizeEmail(email)}`;
}

function editorLoginRateKey(request, email = "") {
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "";
  const ipAddress = normalizeWhitespace(forwarded.split(",")[0] || "").toLowerCase() || "unknown";
  const normalizedEmail = normalizeEmail(email) || "unknown";
  return `${EDITOR_LOGIN_RATE_KEY_PREFIX}${ipAddress}:${normalizedEmail}`;
}

async function readEditorLoginRateState(key, env) {
  const raw = await env.EDITOR_SESSIONS.get(key);

  if (!raw) {
    return {
      attempts: 0,
      blocked_until: 0
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      attempts: Number(parsed.attempts) || 0,
      blocked_until: Number(parsed.blocked_until) || 0
    };
  } catch {
    return {
      attempts: 0,
      blocked_until: 0
    };
  }
}

async function ensureEditorLoginAllowed(request, email, env) {
  const key = editorLoginRateKey(request, email);
  const state = await readEditorLoginRateState(key, env);
  const now = Date.now();

  if (state.blocked_until > now) {
    const error = new Error("EDITOR_LOGIN_RATE_LIMITED");
    error.retryAfter = Math.max(1, Math.ceil((state.blocked_until - now) / 1000));
    throw error;
  }

  return key;
}

async function recordEditorLoginFailure(key, env) {
  const existing = await readEditorLoginRateState(key, env);
  const now = Date.now();
  const attempts = existing.blocked_until > now ? existing.attempts : existing.attempts + 1;
  const next = {
    attempts
  };
  let expirationTtl = EDITOR_LOGIN_WINDOW_SECONDS;

  if (attempts >= EDITOR_LOGIN_MAX_ATTEMPTS) {
    next.blocked_until = now + EDITOR_LOGIN_BLOCK_SECONDS * 1000;
    expirationTtl = EDITOR_LOGIN_BLOCK_SECONDS;
  }

  await env.EDITOR_SESSIONS.put(key, JSON.stringify(next), { expirationTtl });
  return next;
}

async function clearEditorLoginFailures(key, env) {
  if (!key) {
    return;
  }

  await env.EDITOR_SESSIONS.delete(key);
}

function secureEqual(left = "", right = "") {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function hashEditorPassword(password, saltBase64 = "", iterations = 100000) {
  const candidate = password == null ? "" : password.toString();

  if (!candidate.trim()) {
    throw new Error("Assigned password is required.");
  }

  const salt = saltBase64 ? decodeBase64ToUint8Array(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const imported = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(candidate),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    imported,
    256
  );

  return {
    algorithm: "pbkdf2_sha256",
    iterations,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(new Uint8Array(derived))
  };
}

async function verifyEditorPassword(password, stored = null) {
  if (
    !stored ||
    stored.algorithm !== "pbkdf2_sha256" ||
    !stored.salt ||
    !stored.hash ||
    !stored.iterations
  ) {
    return false;
  }

  const hashed = await hashEditorPassword(password, stored.salt, stored.iterations);
  return secureEqual(hashed.hash, stored.hash);
}

function sanitizeEditorUser(user = {}) {
  return {
    email: normalizeEmail(user.email || ""),
    name: normalizeWhitespace(user.name || ""),
    role: normalizeEditorRole(user.role || "writer"),
    active: user.active !== false,
    bootstrap: Boolean(user.bootstrap),
    created_at: user.created_at || "",
    updated_at: user.updated_at || ""
  };
}

async function readEditorUser(email, env) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const raw = await env.EDITOR_SESSIONS.get(editorUserKey(normalizedEmail));

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  return {
    ...sanitizeEditorUser(parsed),
    password_hash: parsed.password_hash || null
  };
}

async function listEditorUsers(env) {
  const users = [];
  let cursor;

  do {
    const page = await env.EDITOR_SESSIONS.list({
      prefix: EDITOR_USER_KEY_PREFIX,
      cursor
    });

    const pageUsers = await Promise.all(
      (page.keys || []).map(async (entry) => {
        const raw = await env.EDITOR_SESSIONS.get(entry.name);
        return raw ? sanitizeEditorUser(JSON.parse(raw)) : null;
      })
    );

    users.push(...pageUsers.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return users.sort(
    (left, right) =>
      left.role.localeCompare(right.role) ||
      left.name.localeCompare(right.name || right.email) ||
      left.email.localeCompare(right.email)
  );
}

async function writeEditorUser(user, env) {
  const timestamp = new Date().toISOString();
  const existing = await readEditorUser(user.email, env);
  const next = {
    email: normalizeEmail(user.email),
    name: normalizeWhitespace(user.name || ""),
    role: normalizeEditorRole(user.role || existing?.role || "writer"),
    active: user.active !== false,
    bootstrap: false,
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
    password_hash: user.password_hash || existing?.password_hash || null
  };

  await env.EDITOR_SESSIONS.put(editorUserKey(next.email), JSON.stringify(next));
  return sanitizeEditorUser(next);
}

function resolveBootstrapEditorUser(env, email, password) {
  const bootstrapEmail = normalizeEmail(env.EDITOR_BOOTSTRAP_EMAIL || "");
  const bootstrapPassword = env.EDITOR_BOOTSTRAP_PASSWORD || "";

  if (!bootstrapEmail || !bootstrapPassword) {
    return null;
  }

  if (!secureEqual(email, bootstrapEmail) || !secureEqual(password, bootstrapPassword)) {
    return null;
  }

  return {
    email: bootstrapEmail,
    name: normalizeWhitespace(env.EDITOR_BOOTSTRAP_NAME || "") || "Admin",
    role: "admin",
    active: true,
    bootstrap: true,
    created_at: "",
    updated_at: ""
  };
}

async function authenticateEditorUser(email, password, env) {
  const normalizedEmail = normalizeEmail(email);
  const candidatePassword = password == null ? "" : password.toString();

  if (!normalizedEmail || !candidatePassword) {
    return null;
  }

  const bootstrapUser = resolveBootstrapEditorUser(env, normalizedEmail, candidatePassword);
  if (bootstrapUser) {
    return bootstrapUser;
  }

  const storedUser = await readEditorUser(normalizedEmail, env);

  if (!storedUser || storedUser.active === false) {
    return null;
  }

  const validPassword = await verifyEditorPassword(candidatePassword, storedUser.password_hash);
  return validPassword ? sanitizeEditorUser(storedUser) : null;
}

async function createEditorSession(user, env) {
  const sessionId = crypto.randomUUID().replaceAll("-", "");
  await env.EDITOR_SESSIONS.put(
    editorSessionKey(sessionId),
    JSON.stringify(sanitizeEditorUser(user)),
    {
      expirationTtl: EDITOR_SESSION_TTL_SECONDS
    }
  );
  return sessionId;
}

async function readEditorSession(request, env) {
  const internalSession = internalEditorSessions.get(request);
  if (internalSession) {
    return internalSession;
  }

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionId = cookies[EDITOR_SESSION_COOKIE];

  if (!sessionId) {
    return null;
  }

  const raw = await env.EDITOR_SESSIONS.get(editorSessionKey(sessionId));

  if (!raw) {
    return null;
  }

  return {
    id: sessionId,
    ...sanitizeEditorUser(JSON.parse(raw))
  };
}

async function requireEditorSession(request, env, { admin = false } = {}) {
  const session = await readEditorSession(request, env);

  if (!session || session.active === false) {
    throw new Error("EDITOR_UNAUTHENTICATED");
  }

  if (admin && session.role !== "admin") {
    throw new Error("EDITOR_FORBIDDEN");
  }

  return session;
}

function requireEditorRepoToken(env) {
  const token = normalizeWhitespace(env.GITHUB_SERVER_TOKEN || "");

  if (!token) {
    throw new Error("EDITOR_REPO_TOKEN_MISSING");
  }

  return token;
}

function normalizeTagList(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags
      .map((tag) => normalizeWhitespace(tag))
      .filter(Boolean);
  }

  return normalizeWhitespace(rawTags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeEditorArticlePayload(rawArticle = {}) {
  return {
    slug: slugify(rawArticle.slug || ""),
    title: normalizeWhitespace(rawArticle.title || ""),
    kicker: normalizeWhitespace(rawArticle.kicker || ""),
    description: normalizeWhitespace(rawArticle.description || ""),
    author: normalizeWhitespace(rawArticle.author || ""),
    date: normalizeWhitespace(rawArticle.date || ""),
    tags: normalizeTagList(rawArticle.tags || []),
    featured_image: normalizeWhitespace(rawArticle.featured_image || ""),
    body: rawArticle.body == null ? "" : rawArticle.body.toString()
  };
}

function computeEditorArticleErrors(article = {}, { requireSlug = false } = {}) {
  const errors = [];

  if (requireSlug && !article.slug) {
    errors.push("Article slug is required.");
  }

  if (!article.title) {
    errors.push("Headline is required.");
  }

  if (!article.description) {
    errors.push("Lede is required.");
  }

  if (!article.author) {
    errors.push("Author is required.");
  }

  if (!article.date) {
    errors.push("Publication date is required.");
  }

  return errors;
}

function isGitHubMissingError(error) {
  const message = (error?.message || "").toLowerCase();
  return message.includes("not found") || message.includes("\"status\":\"404\"") || message.includes(" 404");
}

function articleResponseFromParsed(slug, repoPath, parsed = {}) {
  const data = parsed.data || {};
  return {
    slug,
    title: data.title || slug,
    kicker: data.kicker || "",
    description: data.description || "",
    author: data.author || "",
    date: data.date || "",
    tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
    featured_image: data.featured_image || "",
    body: parsed.body || "",
    url: `/articles/${slug}/`,
    repo_path: repoPath,
    proof: data.proof || null
  };
}

async function handleSession(request, env) {
  try {
    const session = await requireSession(request, env);
    return withCors(
      request,
      json({
        user: {
          login: session.login,
          name: session.name,
          avatar_url: session.avatar_url
        }
      }),
      env
    );
  } catch {
    return withCors(request, json({ error: "Not signed in." }, { status: 401 }), env);
  }
}

async function handleArticles(request, env) {
  try {
    const session = await requireSession(request, env);
    const articles = await loadArticles(session.github_token, env);
    return withCors(request, json({ articles }), env);
  } catch (error) {
    const status = error.message === "UNAUTHENTICATED" ? 401 : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

async function handleArticle(request, env) {
  try {
    const session = await requireSession(request, env);
    const slug = new URL(request.url).searchParams.get("slug") || "";
    if (!slug) {
      return withCors(request, json({ error: "Missing article slug." }, { status: 400 }), env);
    }

    const repoPath = `${env.ARTICLE_CONTENT_PATH || "src/content/articles/"}${slug}.md`;
    const { content } = await readRepoFile(repoPath, session.github_token, env);
    const parsed = parseFrontmatter(content);

    return withCors(
      request,
      json({
        article: {
          slug,
          repo_path: repoPath,
          proof: parsed.data?.proof || null
        }
      }),
      env
    );
  } catch (error) {
    const status = error.message === "UNAUTHENTICATED" ? 401 : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

async function handleDocuments(request, env) {
  try {
    const session = await requireSession(request, env);
    const documents = await loadDocuments(session.github_token, env);
    return withCors(request, json({ documents }), env);
  } catch (error) {
    const status = error.message === "UNAUTHENTICATED" ? 401 : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

async function handleSaveProof(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    const session = await requireSession(request, env);
    const payload = await request.json();
    const slug = normalizeWhitespace(payload.slug || "");

    if (!slug || !payload.proof || typeof payload.proof !== "object") {
      return withCors(request, json({ error: "Missing proof payload." }, { status: 400 }), env);
    }

    const normalizedProof = normalizeProofPayload(payload.proof);
    const documents = await loadDocuments(session.github_token, env);
    const errors = computeProofValidationErrors(normalizedProof, documents);

    if (errors.length) {
      return withCors(request, json({ error: "Proof validation failed.", details: errors }, { status: 400 }), env);
    }

    const repoPath = `${env.ARTICLE_CONTENT_PATH || "src/content/articles/"}${slug}.md`;
    const { content, sha } = await readRepoFile(repoPath, session.github_token, env);
    const parsed = parseFrontmatter(content);
    parsed.data.proof = normalizedProof;
    const nextContent = stringifyFrontmatter(parsed.data, parsed.body);

    await writeRepoTextFile(
      repoPath,
      nextContent,
      `Update proof for "${parsed.data?.title || slug}"`,
      sha,
      session.github_token,
      env
    );

    return withCors(request, json({ ok: true }), env);
  } catch (error) {
    const status =
      error.message === "UNAUTHENTICATED"
        ? 401
        : error.message === "FORBIDDEN_ORIGIN"
          ? 403
          : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

async function handleCreateDocument(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    const session = await requireSession(request, env);
    const payload = await request.json();

    const title = normalizeWhitespace(payload.title || "");
    const description = normalizeWhitespace(payload.description || "");
    const obtained = normalizeWhitespace(payload.obtained || "");
    const sourceMethod = normalizeWhitespace(payload.source_method || "");
    const fileName = normalizeWhitespace(payload.file_name || "");
    const mimeType = normalizeWhitespace(payload.mime_type || "");
    const fileBase64 = payload.file_base64 || "";

    if (!title || !description || !obtained || !sourceMethod || !fileName || !fileBase64) {
      return withCors(request, json({ error: "Missing document fields." }, { status: 400 }), env);
    }

    let baseSlug = slugify(title) || "source-document";
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      try {
        await readRepoFile(`${env.DOCUMENT_CONTENT_PATH || "src/content/documents/"}${slug}.md`, session.github_token, env);
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      } catch {
        break;
      }
    }

    const extension = fileName.split(".").pop()?.toLowerCase() || (mimeType === "application/pdf" ? "pdf" : "bin");
    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      return withCors(request, json({ error: "Unsupported file type." }, { status: 400 }), env);
    }

    const fileUrl = `/documents/${slug}.${extension}`;
    const assetPath = `${env.DOCUMENT_ASSET_PATH || "static/documents/"}${slug}.${extension}`;
    const repoPath = `${env.DOCUMENT_CONTENT_PATH || "src/content/documents/"}${slug}.md`;
    const bytes = decodeBase64ToUint8Array(fileBase64);

    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return withCors(request, json({ error: "Source files must be 25 MB or smaller." }, { status: 400 }), env);
    }

    await writeRepoBinaryFile(assetPath, bytes, `Add source file "${title}"`, session.github_token, env);

    const frontmatter = yaml.dump(
      {
        title,
        file: fileUrl,
        primary_source: true,
        description,
        obtained,
        source_method: sourceMethod
      },
      {
        lineWidth: 1000,
        noRefs: true,
        sortKeys: false
      }
    );

    await writeRepoTextFile(
      repoPath,
      `---\n${frontmatter}---\n`,
      `Add source document "${title}"`,
      undefined,
      session.github_token,
      env
    );

    return withCors(
      request,
      json({
        document: {
          slug,
          title,
          description,
          obtained,
          source_method: sourceMethod,
          url: `/documents/${slug}/`,
          file_url: fileUrl,
          repo_path: repoPath
        }
      }),
      env
    );
  } catch (error) {
    const status =
      error.message === "UNAUTHENTICATED"
        ? 401
        : error.message === "FORBIDDEN_ORIGIN"
          ? 403
          : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

async function handleLogout(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    const cookies = parseCookies(request.headers.get("Cookie") || "");
    const sessionId = cookies[SESSION_COOKIE];
    const secure = isSecureRequest(request);

    if (sessionId) {
      await env.EDITOR_SESSIONS.delete(sessionId);
    }

    return withCors(
      request,
      new Response("", {
        status: 204,
        headers: {
          "Set-Cookie": clearCookie(SESSION_COOKIE, { secure, sameSite: "None" })
        }
      }),
      env
    );
  } catch (error) {
    const status = error.message === "FORBIDDEN_ORIGIN" ? 403 : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

function editorErrorStatus(error) {
  if (error.message === "EDITOR_LOGIN_RATE_LIMITED") {
    return 429;
  }

  if (error.message === "EDITOR_UNAUTHENTICATED") {
    return 401;
  }

  if (error.message === "EDITOR_FORBIDDEN" || error.message === "FORBIDDEN_ORIGIN") {
    return 403;
  }

  return 500;
}

function bootstrapEditorSummary(env) {
  const email = normalizeEmail(env.EDITOR_BOOTSTRAP_EMAIL || "");
  const password = env.EDITOR_BOOTSTRAP_PASSWORD || "";

  if (!email || !password) {
    return null;
  }

  return {
    email,
    name: normalizeWhitespace(env.EDITOR_BOOTSTRAP_NAME || "") || "Admin",
    role: "admin",
    active: true,
    bootstrap: true,
    created_at: "",
    updated_at: ""
  };
}

async function listAllEditorUsers(env) {
  const users = await listEditorUsers(env);
  const bootstrap = bootstrapEditorSummary(env);

  if (!bootstrap) {
    return users;
  }

  return [bootstrap, ...users.filter((user) => user.email !== bootstrap.email)];
}

async function handleEditorSession(request, env) {
  try {
    const session = await requireEditorSession(request, env);
    return withCors(
      request,
      json({
        user: sanitizeEditorUser(session)
      }),
      env
    );
  } catch (error) {
    return withCors(request, json({ error: "Not signed in." }, { status: 401 }), env);
  }
}

async function handleEditorLogin(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    const payload = await request.json();
    const email = normalizeEmail(payload.email || "");
    const password = payload.password == null ? "" : payload.password.toString();
    const rateLimitKey = await ensureEditorLoginAllowed(request, email, env);
    const user = await authenticateEditorUser(email, password, env);

    if (!user) {
      const failureState = await recordEditorLoginFailure(rateLimitKey, env);

      if (failureState.blocked_until) {
        return withCors(
          request,
          json(
            { error: "Too many login attempts. Try again in a few minutes." },
            {
              status: 429,
              headers: {
                "Retry-After": String(EDITOR_LOGIN_BLOCK_SECONDS)
              }
            }
          ),
          env
        );
      }

      return withCors(request, json({ error: "Invalid editor login." }, { status: 401 }), env);
    }

    await clearEditorLoginFailures(rateLimitKey, env);
    const sessionId = await createEditorSession(user, env);
    const secure = isSecureRequest(request);

    return withCors(
      request,
      new Response(
        JSON.stringify(
          {
            user: sanitizeEditorUser(user)
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookie(EDITOR_SESSION_COOKIE, sessionId, {
              maxAge: EDITOR_SESSION_TTL_SECONDS,
              secure,
              sameSite: "None"
            })
          }
        }
      ),
      env
    );
  } catch (error) {
    if (error.message === "EDITOR_LOGIN_RATE_LIMITED") {
      return withCors(
        request,
        json(
          { error: "Too many login attempts. Try again in a few minutes." },
          {
            status: 429,
            headers: {
              "Retry-After": String(error.retryAfter || EDITOR_LOGIN_BLOCK_SECONDS)
            }
          }
        ),
        env
      );
    }

    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorLogout(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    const cookies = parseCookies(request.headers.get("Cookie") || "");
    const sessionId = cookies[EDITOR_SESSION_COOKIE];
    const secure = isSecureRequest(request);

    if (sessionId) {
      await env.EDITOR_SESSIONS.delete(editorSessionKey(sessionId));
    }

    return withCors(
      request,
      new Response("", {
        status: 204,
        headers: {
          "Set-Cookie": clearCookie(EDITOR_SESSION_COOKIE, { secure, sameSite: "None" })
        }
      }),
      env
    );
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorArticles(request, env) {
  try {
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const articles = await loadArticles(token, env);
    return withCors(request, json({ articles }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorAuthors(request, env) {
  try {
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const authors = await loadAuthors(token, env);
    return withCors(request, json({ authors }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorDocuments(request, env) {
  try {
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const documents = await loadDocuments(token, env);
    return withCors(request, json({ documents }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorArticle(request, env) {
  try {
    await requireEditorSession(request, env);
    const slug = normalizeWhitespace(new URL(request.url).searchParams.get("slug") || "");

    if (!slug) {
      return withCors(request, json({ error: "Missing article slug." }, { status: 400 }), env);
    }

    const token = requireEditorRepoToken(env);
    const repoPath = `${env.ARTICLE_CONTENT_PATH || "src/content/articles/"}${slug}.md`;
    const { content } = await readRepoFile(repoPath, token, env);
    const parsed = parseFrontmatter(content);

    return withCors(
      request,
      json({
        article: articleResponseFromParsed(slug, repoPath, parsed)
      }),
      env
    );
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorSaveArticle(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const payload = await request.json();
    const article = normalizeEditorArticlePayload(payload.article || {});
    const repoPathInput = normalizeWhitespace(payload.repo_path || "");
    const currentSlug = repoPathInput ? pathStem(repoPathInput) : "";
    const slug = article.slug || slugify(payload.slug || currentSlug || article.title);
    const errors = computeEditorArticleErrors(
      {
        ...article,
        slug
      },
      { requireSlug: true }
    );

    if (errors.length) {
      return withCors(request, json({ error: "Article validation failed.", details: errors }, { status: 400 }), env);
    }

    if (repoPathInput && currentSlug && currentSlug !== slug) {
      return withCors(
        request,
        json({ error: "Renaming existing article slugs is not supported in the editor yet." }, { status: 400 }),
        env
      );
    }

    const repoPath = repoPathInput || `${env.ARTICLE_CONTENT_PATH || "src/content/articles/"}${slug}.md`;
    let sha;
    let parsed = {
      data: {},
      body: ""
    };

    try {
      const current = await readRepoFile(repoPath, token, env);

      if (!repoPathInput) {
        return withCors(request, json({ error: "That article slug already exists." }, { status: 409 }), env);
      }

      sha = current.sha;
      parsed = parseFrontmatter(current.content);
    } catch (error) {
      if (repoPathInput || !isGitHubMissingError(error)) {
        throw error;
      }
    }

    const nextData = {
      ...(parsed.data || {}),
      kicker: article.kicker,
      title: article.title,
      description: article.description,
      author: article.author,
      date: article.date,
      tags: article.tags,
      featured_image: article.featured_image || ""
    };
    const nextContent = stringifyFrontmatter(nextData, article.body);

    await writeRepoTextFile(
      repoPath,
      nextContent,
      `${sha ? "Update" : "Create"} article "${article.title}"`,
      sha,
      token,
      env
    );

    return withCors(
      request,
      json({
        article: articleResponseFromParsed(slug, repoPath, {
          data: nextData,
          body: article.body
        })
      }),
      env
    );
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorSaveProof(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const payload = await request.json();
    const slug = normalizeWhitespace(payload.slug || "");

    if (!slug || !payload.proof || typeof payload.proof !== "object") {
      return withCors(request, json({ error: "Missing proof payload." }, { status: 400 }), env);
    }

    const normalizedProof = normalizeProofPayload(payload.proof);
    const documents = await loadDocuments(token, env);
    const errors = computeProofValidationErrors(normalizedProof, documents);

    if (errors.length) {
      return withCors(request, json({ error: "Proof validation failed.", details: errors }, { status: 400 }), env);
    }

    const repoPath = `${env.ARTICLE_CONTENT_PATH || "src/content/articles/"}${slug}.md`;
    const { content, sha } = await readRepoFile(repoPath, token, env);
    const parsed = parseFrontmatter(content);
    parsed.data.proof = normalizedProof;
    const nextContent = stringifyFrontmatter(parsed.data, parsed.body);

    await writeRepoTextFile(
      repoPath,
      nextContent,
      `Update proof for "${parsed.data?.title || slug}"`,
      sha,
      token,
      env
    );

    return withCors(request, json({ ok: true }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorCreateDocument(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    await requireEditorSession(request, env);
    const token = requireEditorRepoToken(env);
    const payload = await request.json();

    const title = normalizeWhitespace(payload.title || "");
    const description = normalizeWhitespace(payload.description || "");
    const obtained = normalizeWhitespace(payload.obtained || "");
    const sourceMethod = normalizeWhitespace(payload.source_method || "");
    const fileName = normalizeWhitespace(payload.file_name || "");
    const mimeType = normalizeWhitespace(payload.mime_type || "");
    const fileBase64 = payload.file_base64 || "";

    if (!title || !description || !obtained || !sourceMethod || !fileName || !fileBase64) {
      return withCors(request, json({ error: "Missing document fields." }, { status: 400 }), env);
    }

    let baseSlug = slugify(title) || "source-document";
    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      try {
        await readRepoFile(`${env.DOCUMENT_CONTENT_PATH || "src/content/documents/"}${slug}.md`, token, env);
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      } catch {
        break;
      }
    }

    const extension = fileName.split(".").pop()?.toLowerCase() || (mimeType === "application/pdf" ? "pdf" : "bin");
    if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
      return withCors(request, json({ error: "Unsupported file type." }, { status: 400 }), env);
    }

    const fileUrl = `/documents/${slug}.${extension}`;
    const assetPath = `${env.DOCUMENT_ASSET_PATH || "static/documents/"}${slug}.${extension}`;
    const repoPath = `${env.DOCUMENT_CONTENT_PATH || "src/content/documents/"}${slug}.md`;
    const bytes = decodeBase64ToUint8Array(fileBase64);

    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return withCors(request, json({ error: "Source files must be 25 MB or smaller." }, { status: 400 }), env);
    }

    await writeRepoBinaryFile(assetPath, bytes, `Add source file "${title}"`, token, env);

    const frontmatter = yaml.dump(
      {
        title,
        file: fileUrl,
        primary_source: true,
        description,
        obtained,
        source_method: sourceMethod
      },
      {
        lineWidth: 1000,
        noRefs: true,
        sortKeys: false
      }
    );

    await writeRepoTextFile(
      repoPath,
      `---\n${frontmatter}---\n`,
      `Add source document "${title}"`,
      undefined,
      token,
      env
    );

    return withCors(
      request,
      json({
        document: {
          slug,
          title,
          description,
          obtained,
          source_method: sourceMethod,
          url: `/documents/${slug}/`,
          file_url: fileUrl,
          repo_path: repoPath
        }
      }),
      env
    );
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorAdminUsers(request, env) {
  try {
    await requireEditorSession(request, env, { admin: true });
    const users = await listAllEditorUsers(env);
    return withCors(request, json({ users }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorAdminCreateUser(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    await requireEditorSession(request, env, { admin: true });
    const payload = await request.json();
    const email = normalizeEmail(payload.email || "");
    const name = normalizeWhitespace(payload.name || "");
    const role = normalizeEditorRole(payload.role || "writer");
    const active = payload.active !== false;
    const password = payload.password == null ? "" : payload.password.toString();

    if (!email || !name || !password) {
      return withCors(
        request,
        json({ error: "Name, email, role, and assigned password are required." }, { status: 400 }),
        env
      );
    }

    const existing = await readEditorUser(email, env);

    if (existing) {
      return withCors(request, json({ error: "That editor login already exists." }, { status: 409 }), env);
    }

    const password_hash = await hashEditorPassword(password);
    const user = await writeEditorUser(
      {
        email,
        name,
        role,
        active,
        password_hash
      },
      env
    );

    return withCors(request, json({ user }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

async function handleEditorAdminUpdateUser(request, env) {
  try {
    ensureAllowedOrigin(request, env);
    await requireEditorSession(request, env, { admin: true });
    const payload = await request.json();
    const email = normalizeEmail(payload.email || "");
    const bootstrap = bootstrapEditorSummary(env);

    if (!email) {
      return withCors(request, json({ error: "Editor email is required." }, { status: 400 }), env);
    }

    if (bootstrap && email === bootstrap.email) {
      return withCors(
        request,
        json({ error: "The bootstrap admin login can only be changed through Worker secrets." }, { status: 400 }),
        env
      );
    }

    const existing = await readEditorUser(email, env);

    if (!existing) {
      return withCors(request, json({ error: "That editor login does not exist." }, { status: 404 }), env);
    }

    const password = payload.password == null ? "" : payload.password.toString();
    const password_hash = password ? await hashEditorPassword(password) : existing.password_hash;
    const user = await writeEditorUser(
      {
        ...existing,
        name: payload.name != null ? payload.name : existing.name,
        role: payload.role != null ? payload.role : existing.role,
        active: payload.active != null ? Boolean(payload.active) : existing.active,
        password_hash
      },
      env
    );

    return withCors(request, json({ user }), env);
  } catch (error) {
    return withCors(request, json({ error: error.message }, { status: editorErrorStatus(error) }), env);
  }
}

function parseInternalRoles(value = "") {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((role) => normalizeEditorRole(role))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildInternalSessions(request, env) {
  const providedSecret = request.headers.get("X-Internal-Secret");
  if (!providedSecret) {
    return null;
  }

  const expectedSecret = normalizeWhitespace(env.INTERNAL_SECRET || "");
  if (!expectedSecret || !secureEqual(providedSecret, expectedSecret)) {
    return { error: "INTERNAL_FORBIDDEN" };
  }

  const email = normalizeEmail(request.headers.get("X-User-Email") || "");
  const githubToken = normalizeWhitespace(request.headers.get("X-GitHub-Token") || "");
  const roles = parseInternalRoles(request.headers.get("X-User-Roles") || "[]");
  const isAdmin = roles.includes("admin");
  const role = isAdmin ? "admin" : roles[0] || "writer";
  const name = email ? email.split("@")[0] || "internal" : "internal";
  const syntheticId = `internal:${crypto.randomUUID()}`;

  return {
    proof: {
      id: syntheticId,
      login: email || "internal",
      name,
      avatar_url: "",
      email,
      role,
      active: true,
      github_token: githubToken
    },
    editor: {
      id: syntheticId,
      email,
      name,
      role,
      active: true
    }
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;

    const internalSessions = buildInternalSessions(request, env);
    if (internalSessions?.error) {
      response = withCors(request, json({ error: internalSessions.error }, { status: 403 }), env);
    } else if (internalSessions && (url.pathname.startsWith("/api/editor/") || url.pathname.startsWith("/api/proof/"))) {
      internalProofSessions.set(request, internalSessions.proof);
      internalEditorSessions.set(request, internalSessions.editor);

      if (url.pathname.startsWith("/api/proof/") && !internalSessions.proof.github_token) {
        response = withCors(request, json({ error: "INTERNAL_GITHUB_TOKEN_REQUIRED" }, { status: 403 }), env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/session") {
        response = handleEditorSession(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/articles") {
        response = handleEditorArticles(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/article") {
        response = handleEditorArticle(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/editor/article/save") {
        response = handleEditorSaveArticle(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/editor/proof/save") {
        response = handleEditorSaveProof(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/authors") {
        response = handleEditorAuthors(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/documents") {
        response = handleEditorDocuments(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/editor/create-document") {
        response = handleEditorCreateDocument(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/editor/admin/users") {
        response = handleEditorAdminUsers(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/editor/admin/users") {
        response = handleEditorAdminCreateUser(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/editor/admin/users/update") {
        response = handleEditorAdminUpdateUser(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/proof/articles") {
        response = handleArticles(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/proof/article") {
        response = handleArticle(request, env);
      } else if (request.method === "GET" && url.pathname === "/api/proof/documents") {
        response = handleDocuments(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/proof/save") {
        response = handleSaveProof(request, env);
      } else if (request.method === "POST" && url.pathname === "/api/proof/create-document") {
        response = handleCreateDocument(request, env);
      } else {
        response = text("Not found", 404);
      }
    } else if (request.method === "OPTIONS") {
      response = handleOptions(request, env);
    } else if (request.method === "GET" && url.pathname === "/auth") {
      response = cmsAuthRedirect(request, env);
    } else if (request.method === "GET" && url.pathname === "/proof/login") {
      response = proofLoginRedirect(request, env);
    } else if (request.method === "GET" && url.pathname === "/callback") {
      response = handleCallback(request, env);
    } else if (request.method === "POST" && url.pathname === "/proof/logout") {
      response = handleLogout(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/login") {
      response = handleEditorLogin(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/logout") {
      response = handleEditorLogout(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/session") {
      response = handleEditorSession(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/articles") {
      response = handleEditorArticles(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/article") {
      response = handleEditorArticle(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/article/save") {
      response = handleEditorSaveArticle(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/proof/save") {
      response = handleEditorSaveProof(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/authors") {
      response = handleEditorAuthors(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/documents") {
      response = handleEditorDocuments(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/create-document") {
      response = handleEditorCreateDocument(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/editor/admin/users") {
      response = handleEditorAdminUsers(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/admin/users") {
      response = handleEditorAdminCreateUser(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/editor/admin/users/update") {
      response = handleEditorAdminUpdateUser(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/session") {
      response = handleSession(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/proof/articles") {
      response = handleArticles(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/proof/article") {
      response = handleArticle(request, env);
    } else if (request.method === "GET" && url.pathname === "/api/proof/documents") {
      response = handleDocuments(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/proof/save") {
      response = handleSaveProof(request, env);
    } else if (request.method === "POST" && url.pathname === "/api/proof/create-document") {
      response = handleCreateDocument(request, env);
    } else if (internalSessions) {
      response = withCors(request, json({ error: "INTERNAL_FORBIDDEN" }, { status: 403 }), env);
    } else {
      response = text("Not found", 404);
    }

    return finalizeWorkerResponse(await response);
  }
};
