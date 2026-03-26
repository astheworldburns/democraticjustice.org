import yaml from "js-yaml";

const SESSION_COOKIE = "dj_proof_session";
const PROOF_STATE_COOKIE = "dj_proof_state";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);

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

function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function cmsAuthHtml({ provider = "github", token, error, errorCode }) {
  const state = error ? "error" : "success";
  const content = error ? { provider, error, errorCode } : { provider, token };
  const providerLiteral = JSON.stringify(provider);
  const stateLiteral = JSON.stringify(state);
  const payloadLiteral = JSON.stringify(JSON.stringify(content));

  return new Response(
    `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        function receiveMessage(event) {
          if (event.data !== "authorizing:" + ${providerLiteral}) {
            return;
          }
          window.opener.postMessage("authorization:" + ${providerLiteral} + ":" + ${stateLiteral} + ":" + ${payloadLiteral}, event.origin);
        }

        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:" + ${providerLiteral}, "*");
      })();
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": clearCookie("csrf-token")
      }
    }
  );
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
        secure
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

  if (provider !== "github") {
    return cmsAuthHtml({
      error: "Your Git backend is not supported by the authenticator.",
      errorCode: "UNSUPPORTED_BACKEND"
    });
  }

  if (allowedDomains.length && !isAllowedDomain(domain, allowedDomains)) {
    return cmsAuthHtml({
      provider,
      error: "Your domain is not allowed to use the authenticator.",
      errorCode: "UNSUPPORTED_DOMAIN"
    });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return cmsAuthHtml({
      provider,
      error: "OAuth app client ID or secret is not configured.",
      errorCode: "MISCONFIGURED_CLIENT"
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
      "Set-Cookie": cookie("csrf-token", `github_${csrfToken}`, { maxAge: 600, secure })
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
            headers.append("Set-Cookie", clearCookie(PROOF_STATE_COOKIE, { secure }));
            headers.append(
              "Set-Cookie",
              cookie(SESSION_COOKIE, sessionId, {
                maxAge: SESSION_TTL_SECONDS,
                secure
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

  const cmsState = cookies["csrf-token"] || "";
  const cmsMatch = cmsState.match(/^github_([0-9a-f]{32})$/);

  if (!cmsMatch || cmsMatch[1] !== state) {
    return cmsAuthHtml({
      provider: "github",
      error: "Potential CSRF attack detected. Authentication flow aborted.",
      errorCode: "CSRF_DETECTED"
    });
  }

  try {
    const token = await githubTokenExchange(url, code, env);
    return cmsAuthHtml({ provider: "github", token });
  } catch (error) {
    return cmsAuthHtml({
      provider: "github",
      error: error.message || "Failed to request an access token.",
      errorCode: "TOKEN_REQUEST_FAILED"
    });
  }
}

function normalizeDocumentUrl(value = "") {
  const trimmed = normalizeWhitespace(value);
  return /^\/documents\/[a-z0-9-]+\/$/i.test(trimmed) ? trimmed : "";
}

function dedupeProofSources(entries = []) {
  const seen = new Set();
  const next = [];

  for (const entry of entries) {
    const documentUrl =
      typeof entry === "string"
        ? normalizeDocumentUrl(entry)
        : normalizeDocumentUrl(entry?.document_url || entry?.documentUrl || "");

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
        if (!knownDocumentUrls.has(source.document_url)) {
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
        repo_path: entry.path
      };
    })
  );

  return sortArticles(articles);
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
        url: `/documents/${slug}/`,
        file_url: parsed.data?.file || "",
        repo_path: entry.path
      };
    })
  );

  return sortDocuments(documents);
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
          "Set-Cookie": clearCookie(SESSION_COOKIE, { secure })
        }
      }),
      env
    );
  } catch (error) {
    const status = error.message === "FORBIDDEN_ORIGIN" ? 403 : 500;
    return withCors(request, json({ error: error.message }, { status }), env);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    if (request.method === "GET" && url.pathname === "/auth") {
      return cmsAuthRedirect(request, env);
    }

    if (request.method === "GET" && url.pathname === "/proof/login") {
      return proofLoginRedirect(request, env);
    }

    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    if (request.method === "POST" && url.pathname === "/proof/logout") {
      return handleLogout(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      return handleSession(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/proof/articles") {
      return handleArticles(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/proof/article") {
      return handleArticle(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/proof/documents") {
      return handleDocuments(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/proof/save") {
      return handleSaveProof(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/proof/create-document") {
      return handleCreateDocument(request, env);
    }

    return text("Not found", 404);
  }
};
