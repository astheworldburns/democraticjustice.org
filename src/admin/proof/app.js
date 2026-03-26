import yaml from "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm";

const root = document.getElementById("proof-desk-root");
const PROOF_TOKEN_KEY = "dj-proof-desk-token";

const state = {
  config: null,
  articles: [],
  documents: [],
  authMode: "token",
  sessionUser: null,
  articleFilter: "",
  selectedSlug: "",
  selectedArticle: null,
  selectedArticleLoading: false,
  sourceSearches: {},
  newSourceForms: {},
  token: "",
  tokenSource: "",
  tokenDraft: "",
  status: null,
  loading: true,
  saving: false
};

function escapeHtml(value = "") {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWhitespace(value = "") {
  return value
    .toString()
    .replace(/\s+/g, " ")
    .trim();
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => hasMeaningfulValue(entry));
  }

  return normalizeWhitespace(value).length > 0;
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

function defaultAxiom() {
  return {
    premise: "",
    no_source_needed: false,
    sources: []
  };
}

function defaultInference() {
  return {
    step: ""
  };
}

function normalizeSources(rawAxiom = {}) {
  const sources = [];

  if (Array.isArray(rawAxiom.sources)) {
    for (const source of rawAxiom.sources) {
      const documentUrl =
        typeof source === "string"
          ? source
          : source && typeof source === "object"
            ? source.document_url
            : "";

      if (documentUrl) {
        sources.push({ document_url: documentUrl });
      }
    }
  }

  if (rawAxiom.source_url) {
    sources.push({ document_url: rawAxiom.source_url });
  }

  return dedupeSources(sources);
}

function normalizeProof(rawProof = {}) {
  const axioms = Array.isArray(rawProof.axioms)
    ? rawProof.axioms.map((axiom) => ({
        premise: axiom?.premise || "",
        no_source_needed: Boolean(axiom?.no_source_needed),
        sources: normalizeSources(axiom)
      }))
    : [];
  const logic = Array.isArray(rawProof.logic)
    ? rawProof.logic.map((entry) => ({
        step: entry?.step || ""
      }))
    : [];

  return {
    issue: rawProof?.issue || "",
    axioms: axioms.length ? axioms : [defaultAxiom()],
    logic: logic.length ? logic : [defaultInference()],
    conclusion: rawProof?.conclusion || "",
    inference: rawProof?.inference || ""
  };
}

function serializeProof(proof = {}) {
  const next = {
    issue: (proof.issue || "").trim(),
    axioms: (proof.axioms || []).map((axiom) => ({
      premise: (axiom.premise || "").trim(),
      sources: axiom.no_source_needed ? [] : dedupeSources(axiom.sources || []),
      no_source_needed: Boolean(axiom.no_source_needed)
    })),
    logic: (proof.logic || []).map((entry) => ({
      step: (entry.step || "").trim()
    })),
    conclusion: (proof.conclusion || "").trim()
  };

  if ((proof.inference || "").trim()) {
    next.inference = proof.inference.trim();
  }

  return next;
}

function dedupeSources(sources = []) {
  const seen = new Set();
  const entries = [];

  for (const source of sources) {
    const documentUrl = source?.document_url || source?.documentUrl || "";

    if (!documentUrl || seen.has(documentUrl)) {
      continue;
    }

    seen.add(documentUrl);
    entries.push({ document_url: documentUrl });
  }

  return entries;
}

function computeValidationErrors(proof = {}, documents = state.documents) {
  const errors = [];
  const knownDocuments = Array.isArray(documents) ? documents : [];

  if (!(proof.issue || "").trim()) {
    errors.push("Issue is required.");
  }

  if (!Array.isArray(proof.axioms) || proof.axioms.length === 0) {
    errors.push("At least one axiom is required.");
  } else {
    proof.axioms.forEach((axiom, index) => {
      if (!(axiom.premise || "").trim()) {
        errors.push(`Axiom ${index + 1} needs a premise.`);
      }

      const sourceCount = Array.isArray(axiom.sources) ? axiom.sources.filter((entry) => entry?.document_url).length : 0;

      if (axiom.no_source_needed && sourceCount > 0) {
        errors.push(`Axiom ${index + 1} cannot be source-free and source-backed at the same time.`);
      }

      if (!axiom.no_source_needed && sourceCount === 0) {
        errors.push(`Axiom ${index + 1} needs at least one linked source or a no-source flag.`);
      }

      for (const source of axiom.sources || []) {
        if (
          source?.document_url &&
          !knownDocuments.some((document) => document.url === source.document_url)
        ) {
          errors.push(`Axiom ${index + 1} links to a missing source document: ${source.document_url}`);
        }
      }
    });
  }

  if (!Array.isArray(proof.logic) || proof.logic.length === 0) {
    errors.push("At least one inference is required.");
  } else {
    proof.logic.forEach((entry, index) => {
      if (!(entry.step || "").trim()) {
        errors.push(`Inference ${index + 1} needs text.`);
      }
    });
  }

  if (!(proof.conclusion || "").trim()) {
    errors.push("Conclusion is required.");
  }

  return errors;
}

function countUniqueSources(proof = {}) {
  const urls = new Set();

  for (const axiom of proof.axioms || []) {
    for (const source of axiom.sources || []) {
      if (source?.document_url) {
        urls.add(source.document_url);
      }
    }
  }

  return urls.size;
}

function getDocumentByUrl(documentUrl = "") {
  return state.documents.find((document) => document.url === documentUrl) || null;
}

function filteredArticles() {
  const query = state.articleFilter.trim().toLowerCase();

  if (!query) {
    return state.articles;
  }

  return state.articles.filter((article) => {
    const haystack = [article.title, article.description, article.slug].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function filteredDocumentsForAxiom(index) {
  const query = (state.sourceSearches[index] || "").trim().toLowerCase();
  const attached = new Set(
    (state.selectedArticle?.proof.axioms[index]?.sources || []).map((source) => source.document_url)
  );

  return state.documents.filter((document) => {
    if (attached.has(document.url)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [document.title, document.description, document.source_method, document.slug]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function encodeRepoPath(value = "") {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function base64ToUtf8(value = "") {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
  return bytesToBase64(bytes);
}

function looksLikeToken(value = "") {
  const candidate = value.trim();

  if (!candidate || candidate === "light" || candidate === "dark") {
    return false;
  }

  return (
    /^gh[pousr]_/i.test(candidate) ||
    /^github_pat_/i.test(candidate) ||
    /^[A-Za-z0-9_]{35,}$/.test(candidate)
  );
}

function proofApiBaseUrl() {
  return (state.config?.proof_api_base_url || "").replace(/\/+$/, "");
}

function hasProofApi() {
  return Boolean(proofApiBaseUrl());
}

function proofApiUrl(pathname = "") {
  return `${proofApiBaseUrl()}${pathname}`;
}

async function workerRequest(pathname, options = {}) {
  const response = await fetch(proofApiUrl(pathname), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Proof API request failed (${response.status}).`);
  }

  return response;
}

async function workerJson(pathname, options = {}) {
  const response = await workerRequest(pathname, options);
  return response.json();
}

async function loadWorkerSession() {
  try {
    const response = await fetch(proofApiUrl("/api/session"), {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      state.sessionUser = null;
      state.authMode = "worker";
      return;
    }

    if (!response.ok) {
      state.sessionUser = null;
      state.authMode = "token";
      return;
    }

    const payload = await response.json();
    state.sessionUser = payload.user || null;
    state.authMode = "worker";
  } catch (error) {
    state.sessionUser = null;
    state.authMode = "token";
  }
}

function detectStoredToken() {
  const explicit = sessionStorage.getItem(PROOF_TOKEN_KEY);
  if (looksLikeToken(explicit || "")) {
    return {
      token: explicit.trim(),
      source: "saved-token"
    };
  }

  return {
    token: "",
    source: ""
  };
}

function inferExtension(file) {
  const fromName = file?.name?.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (file?.type === "application/pdf") {
    return "pdf";
  }

  if ((file?.type || "").startsWith("image/")) {
    return file.type.replace("image/", "").toLowerCase();
  }

  return "bin";
}

function ensureUniqueSlug(baseSlug) {
  const existing = new Set(state.documents.map((document) => document.slug));
  let candidate = baseSlug || "source-document";
  let suffix = 2;

  while (existing.has(candidate)) {
    candidate = `${baseSlug || "source-document"}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function parseFrontmatter(rawContent = "") {
  const match = rawContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    throw new Error("The selected article does not have YAML frontmatter.");
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}.`);
  }

  return response.json();
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

async function githubRequest(pathname, options = {}) {
  const token = state.token || "";
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `GitHub request failed (${response.status}).`);
  }

  return response.json();
}

async function loadRepoTree(prefix) {
  const { repo_owner: owner, repo_name: repo, branch } = state.config;
  const response = await githubRequest(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  const tree = Array.isArray(response.tree) ? response.tree : [];

  return tree.filter(
    (entry) =>
      entry?.type === "blob" &&
      entry?.path?.startsWith(prefix) &&
      entry.path.endsWith(".md")
  );
}

async function readRepoBlob(sha) {
  const { repo_owner: owner, repo_name: repo } = state.config;
  const response = await githubRequest(`/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`);
  return base64ToUtf8(response.content || "");
}

async function loadArticlesFromRepo() {
  const articleEntries = await loadRepoTree(state.config.article_content_path);
  const articles = await Promise.all(
    articleEntries.map(async (entry) => {
      const raw = await readRepoBlob(entry.sha);
      const parsed = parseFrontmatter(raw);
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

async function loadDocumentsFromRepo() {
  const documentEntries = await loadRepoTree(state.config.document_content_path);
  const documents = await Promise.all(
    documentEntries.map(async (entry) => {
      const raw = await readRepoBlob(entry.sha);
      const parsed = parseFrontmatter(raw);
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

async function loadArticlesFromWorker() {
  const payload = await workerJson("/api/proof/articles");
  return sortArticles(Array.isArray(payload.articles) ? payload.articles : []);
}

async function loadDocumentsFromWorker() {
  const payload = await workerJson("/api/proof/documents");
  return sortDocuments(Array.isArray(payload.documents) ? payload.documents : []);
}

async function readRepoFile(repoPath) {
  const { repo_owner: owner, repo_name: repo, branch } = state.config;
  const response = await githubRequest(
    `/repos/${owner}/${repo}/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`
  );

  return {
    sha: response.sha,
    content: base64ToUtf8(response.content || "")
  };
}

async function writeRepoTextFile(repoPath, text, message, sha) {
  const { repo_owner: owner, repo_name: repo, branch } = state.config;

  return githubRequest(`/repos/${owner}/${repo}/contents/${encodeRepoPath(repoPath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: utf8ToBase64(text),
      branch,
      sha
    })
  });
}

async function writeRepoBinaryFile(repoPath, bytes, message) {
  const { repo_owner: owner, repo_name: repo, branch } = state.config;

  return githubRequest(`/repos/${owner}/${repo}/contents/${encodeRepoPath(repoPath)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: bytesToBase64(bytes),
      branch
    })
  });
}

function statusMarkup() {
  if (!state.status) {
    return "";
  }

  return `
    <div class="editor-status" data-tone="${escapeHtml(state.status.tone || "info")}">
      ${escapeHtml(state.status.message || "")}
    </div>
  `;
}

function renderArticleCard(article) {
  const isSelected = state.selectedSlug === article.slug;
  const proof = hasMeaningfulValue(article.proof) ? normalizeProof(article.proof || {}) : null;
  const sourceCount = proof ? countUniqueSources(proof) : 0;
  const axiomCount = proof ? proof.axioms.length : 0;

  return `
    <button class="editor-list-card" type="button" data-action="select-article" data-slug="${escapeHtml(article.slug)}" data-selected="${isSelected ? "true" : "false"}">
      <p class="editor-kicker">${escapeHtml(article.date ? new Date(article.date).toLocaleDateString("en-US") : "Undated")}</p>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.description || "")}</p>
      <div class="editor-pill-row">
        <span class="editor-pill">${axiomCount} axioms</span>
        <span class="editor-pill">${sourceCount} docs</span>
      </div>
    </button>
  `;
}

function renderSourceResults(index) {
  const matches = filteredDocumentsForAxiom(index).slice(0, 20);

  if (!matches.length) {
    return `<div class="editor-empty">No matching source documents.</div>`;
  }

  return matches
    .map(
      (document) => `
        <button
          class="editor-list-card"
          type="button"
          data-action="attach-source"
          data-axiom-index="${index}"
          data-document-url="${escapeHtml(document.url)}"
        >
          <h3>${escapeHtml(document.title)}</h3>
          <p>${escapeHtml(document.description || "")}</p>
          <p class="editor-muted">${escapeHtml(document.source_method || "")}</p>
        </button>
      `
    )
    .join("");
}

function renderSelectedSources(index, axiom) {
  if (!axiom.sources.length) {
    return `<div class="editor-empty">No linked documents yet.</div>`;
  }

  return axiom.sources
    .map((source) => {
      const document = getDocumentByUrl(source.document_url);
      const label = document?.title || source.document_url;

      return `
        <div class="editor-source-item">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <div class="editor-muted">${escapeHtml(source.document_url)}</div>
          </div>
          <button class="editor-button-ghost" type="button" data-action="remove-source" data-axiom-index="${index}" data-document-url="${escapeHtml(source.document_url)}">
            Remove
          </button>
        </div>
      `;
    })
    .join("");
}

function renderAxiomBlock(axiom, index) {
  const formState = state.newSourceForms[index] || {};

  return `
    <section class="editor-block">
      <div class="editor-block__header">
        <h3 class="editor-section-title">Axiom ${index + 1}</h3>
        <button class="editor-button-ghost" type="button" data-action="remove-axiom" data-axiom-index="${index}">
          Remove axiom
        </button>
      </div>

      <label class="editor-field">
        <span class="editor-label">Premise</span>
        <textarea class="editor-textarea" data-axiom-index="${index}" data-axiom-field="premise">${escapeHtml(axiom.premise || "")}</textarea>
      </label>

      <label class="editor-checkbox">
        <input type="checkbox" data-axiom-index="${index}" data-axiom-field="no_source_needed" ${axiom.no_source_needed ? "checked" : ""} />
        <span>Mark this axiom as source-free.</span>
      </label>

      ${
        axiom.no_source_needed
          ? ""
          : `
            <div class="editor-field">
              <span class="editor-label">Linked sources</span>
              <div class="editor-source-list">
                ${renderSelectedSources(index, axiom)}
              </div>
            </div>

            <details class="editor-details">
              <summary>Attach an existing source document</summary>
              <div class="editor-details__body">
                <label class="editor-field">
                  <span class="editor-label">Search source archive</span>
                  <input class="editor-input" type="search" value="${escapeHtml(state.sourceSearches[index] || "")}" data-source-search="${index}" />
                </label>
                <div class="editor-results">
                  ${renderSourceResults(index)}
                </div>
              </div>
            </details>

            <details class="editor-details">
              <summary>Create a new source document</summary>
              <div class="editor-details__body">
                <label class="editor-field">
                  <span class="editor-label">Title</span>
                  <input class="editor-input" type="text" value="${escapeHtml(formState.title || "")}" data-new-source-index="${index}" data-new-source-field="title" />
                </label>
                <label class="editor-field">
                  <span class="editor-label">File</span>
                  <input class="editor-file" type="file" accept="application/pdf,.pdf,image/*" data-new-source-index="${index}" data-new-source-field="file" />
                </label>
                <label class="editor-field">
                  <span class="editor-label">Description</span>
                  <textarea class="editor-textarea" data-new-source-index="${index}" data-new-source-field="description">${escapeHtml(formState.description || "")}</textarea>
                </label>
                <div class="editor-row">
                  <label class="editor-field" style="flex: 1 1 16rem;">
                    <span class="editor-label">Obtained</span>
                    <input class="editor-input" type="date" value="${escapeHtml(formState.obtained || "")}" data-new-source-index="${index}" data-new-source-field="obtained" />
                  </label>
                  <label class="editor-field" style="flex: 1 1 20rem;">
                    <span class="editor-label">Source method</span>
                    <input class="editor-input" type="text" value="${escapeHtml(formState.source_method || "")}" data-new-source-index="${index}" data-new-source-field="source_method" />
                  </label>
                </div>
                <div class="editor-actions" style="margin-top: 1rem;">
                  <button class="editor-button-secondary" type="button" data-action="create-source" data-axiom-index="${index}">
                    Create source and attach it
                  </button>
                </div>
              </div>
            </details>
          `
      }
    </section>
  `;
}

function renderInferenceBlock(entry, index) {
  return `
    <section class="editor-block">
      <div class="editor-block__header">
        <h3 class="editor-section-title">Inference ${index + 1}</h3>
        <button class="editor-button-ghost" type="button" data-action="remove-inference" data-logic-index="${index}">
          Remove inference
        </button>
      </div>
      <label class="editor-field">
        <span class="editor-label">Inference</span>
        <textarea class="editor-textarea" data-logic-index="${index}" data-logic-field="step">${escapeHtml(entry.step || "")}</textarea>
      </label>
    </section>
  `;
}

function renderValidationPanel() {
  if (!state.selectedArticle) {
    return "";
  }

  const errors = computeValidationErrors(state.selectedArticle.proof, state.documents);

  if (!errors.length) {
    return `
      <div class="editor-status" data-tone="success">
        Proof structure is complete. Save when the linked record and language are where you want them.
      </div>
    `;
  }

  return `
    <div class="editor-status" data-tone="error">
      <strong>Proof still needs work.</strong>
      <ul class="editor-errors">
        ${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSelectedArticle() {
  if (!state.selectedArticle) {
    return `
      <section class="editor-panel">
        <h2>Pick an article</h2>
        <p>Choose an article from the sidebar to build or revise its proof.</p>
      </section>
    `;
  }

  if (state.selectedArticleLoading) {
    return `
      <section class="editor-panel">
        <h2>${escapeHtml(state.selectedArticle.title)}</h2>
        <p>Loading the article from the repository so the Proof Desk can edit the current proof.</p>
      </section>
    `;
  }

  const { title, description, url, proof } = state.selectedArticle;
  const uniqueSourceCount = countUniqueSources(proof);

  return `
    <section class="editor-panel">
      <div class="editor-panel__header">
        <div>
          <p class="editor-kicker">Proof desk</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="editor-actions">
          ${url ? `<a class="editor-button-ghost" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open article</a>` : ""}
          <button class="editor-button" type="button" data-action="save-proof" ${state.saving ? "disabled" : ""}>
            ${state.saving ? "Saving…" : "Save proof"}
          </button>
        </div>
      </div>
      <p>${escapeHtml(description || "")}</p>
      <div class="editor-pill-row">
        <span class="editor-pill">${proof.axioms.length} axioms</span>
        <span class="editor-pill">${proof.logic.length} inferences</span>
        <span class="editor-pill">${uniqueSourceCount} linked documents</span>
      </div>
      <div id="proof-validation-panel">${renderValidationPanel()}</div>
    </section>

    <section class="editor-panel editor-section">
      <div class="editor-block">
        <label class="editor-field">
          <span class="editor-label">Issue</span>
          <textarea class="editor-textarea" data-proof-field="issue">${escapeHtml(proof.issue || "")}</textarea>
        </label>
      </div>

      <div class="editor-section">
        <div class="editor-panel__header">
          <h2>Axioms</h2>
          <button class="editor-button-secondary" type="button" data-action="add-axiom">Add axiom</button>
        </div>
        ${proof.axioms.map((axiom, index) => renderAxiomBlock(axiom, index)).join("")}
      </div>

      <div class="editor-section">
        <div class="editor-panel__header">
          <h2>Inferences</h2>
          <button class="editor-button-secondary" type="button" data-action="add-inference">Add inference</button>
        </div>
        ${proof.logic.map((entry, index) => renderInferenceBlock(entry, index)).join("")}
      </div>

      <div class="editor-block">
        <label class="editor-field">
          <span class="editor-label">Conclusion</span>
          <textarea class="editor-textarea" data-proof-field="conclusion">${escapeHtml(proof.conclusion || "")}</textarea>
        </label>
      </div>
    </section>
  `;
}

function render() {
  const detectedLabel =
    state.authMode === "worker"
      ? state.sessionUser
        ? `Signed in as ${state.sessionUser.login || "GitHub user"}.`
        : "Not signed in to the Proof Desk yet."
      : state.tokenSource === "saved-token"
        ? "Using a GitHub token stored for this browser session."
        : "No GitHub token detected yet.";

  root.innerHTML = `
    <div class="editor-shell">
      <div class="editor-frame editor-app">
        <div class="editor-toolbar">
          <div class="editor-toolbar__nav">
            <a class="editor-button-ghost" href="/admin/">Back to Editorial Desk</a>
            <a class="editor-button-ghost" href="/admin/cms/">Open Content Desk</a>
          </div>
          <button class="editor-button-secondary" type="button" data-action="refresh-data">Reload desk data</button>
        </div>

        ${statusMarkup()}

        <div class="editor-layout">
          <aside class="editor-sidebar">
            <section class="editor-panel">
              <div class="editor-panel__header">
                <div>
                  <p class="editor-kicker">GitHub session</p>
                  <h2>Authentication</h2>
                </div>
              </div>
              <p>${escapeHtml(detectedLabel)}</p>
              <p class="editor-muted">The Proof Desk now loads article and source data directly from GitHub after you authenticate. It no longer publishes draft manifests on the public site.</p>
              ${
                state.authMode === "worker"
                  ? `
                    <div class="editor-actions" style="margin-top: 1rem;">
                      ${
                        state.sessionUser
                          ? `<button class="editor-button-ghost" type="button" data-action="worker-logout">Sign out</button>`
                          : `<a class="editor-button-secondary" href="${escapeHtml(
                              `${proofApiUrl("/proof/login")}?next=${encodeURIComponent(window.location.href)}`
                            )}">Sign in with GitHub</a>`
                      }
                    </div>
                  `
                  : `
                    <label class="editor-field">
                      <span class="editor-label">Session token</span>
                      <input class="editor-input" type="password" value="${escapeHtml(state.tokenDraft || "")}" data-ui="token-draft" placeholder="Paste a GitHub token for this browser session." />
                    </label>
                    <div class="editor-actions" style="margin-top: 1rem;">
                      <button class="editor-button-secondary" type="button" data-action="save-token">Use token</button>
                      <button class="editor-button-ghost" type="button" data-action="clear-token">Clear token</button>
                    </div>
                  `
              }
            </section>

            <section class="editor-panel">
              <div class="editor-panel__header">
                <div>
                  <p class="editor-kicker">Article picker</p>
                  <h2>Articles</h2>
                </div>
                <span class="editor-muted">${state.articles.length} total</span>
              </div>
              ${
                (state.authMode === "worker" ? state.sessionUser : state.token)
                  ? ""
                  : `<div class="editor-empty">${
                      state.authMode === "worker"
                        ? "Sign in with GitHub to load article and document data."
                        : "Add a GitHub token to load article and document data."
                    }</div>`
              }
              <label class="editor-field">
                <span class="editor-label">Search</span>
                <input class="editor-input" type="search" value="${escapeHtml(state.articleFilter)}" data-ui="article-filter" placeholder="Find an article" />
              </label>
              <div class="editor-list">
                ${
                  filteredArticles().length
                    ? filteredArticles().map((article) => renderArticleCard(article)).join("")
                    : `<div class="editor-empty">No articles match this search.</div>`
                }
              </div>
            </section>
          </aside>

          <main class="editor-main">
            ${renderSelectedArticle()}
          </main>
        </div>
      </div>
    </div>
  `;
}

function updateValidationPanel() {
  const node = document.getElementById("proof-validation-panel");

  if (node) {
    node.innerHTML = renderValidationPanel();
  }
}

function syncSelectedArticleIntoList() {
  // Article summaries stay proof-free now; the desk reloads the source file on demand.
}

async function loadSelectedArticleContent() {
  if (!state.selectedArticle) {
    return;
  }

  if (state.authMode === "worker") {
    const payload = await workerJson(`/api/proof/article?slug=${encodeURIComponent(state.selectedArticle.slug)}`);
    const nextProof = hasMeaningfulValue(payload.article?.proof) ? normalizeProof(payload.article.proof || {}) : normalizeProof({});

    state.selectedArticle = {
      ...state.selectedArticle,
      repo_path: payload.article?.repo_path || state.selectedArticle.repo_path,
      proof: nextProof
    };
    return;
  }

  const { content } = await readRepoFile(state.selectedArticle.repo_path);
  const parsed = parseFrontmatter(content);
  const nextProof = hasMeaningfulValue(parsed.data?.proof) ? normalizeProof(parsed.data.proof || {}) : normalizeProof({});

  state.selectedArticle = {
    ...state.selectedArticle,
    proof: nextProof
  };
}

async function selectArticle(slug) {
  const article = state.articles.find((entry) => entry.slug === slug);

  if (!article) {
    return;
  }

  state.selectedSlug = slug;
  state.selectedArticleLoading = true;
  state.selectedArticle = {
    ...article,
    repo_path: article.repo_path,
    proof: normalizeProof({})
  };
  state.sourceSearches = {};
  state.newSourceForms = {};
  render();

  try {
    await loadSelectedArticleContent();
  } catch (error) {
    state.status = {
      message: `Could not load the article proof. ${error.message || error}`,
      tone: "error"
    };
  }

  state.selectedArticleLoading = false;
  updateValidationPanel();
  render();
}

function setStatus(message, tone = "info") {
  state.status = {
    message,
    tone
  };
  render();
}

async function loadDeskData() {
  state.loading = true;

  if (!state.config) {
    state.config = await fetchJson("/admin/proof/data/config.json");
  }

  if (hasProofApi()) {
    await loadWorkerSession();
  }

  if (state.authMode === "worker" && !state.sessionUser) {
    state.articles = [];
    state.documents = [];
    state.selectedSlug = "";
    state.selectedArticle = null;
    state.loading = false;
    render();
    return;
  }

  if (state.authMode !== "worker" && !state.token) {
    state.articles = [];
    state.documents = [];
    state.selectedSlug = "";
    state.selectedArticle = null;
    state.loading = false;
    render();
    return;
  }

  const [articles, documents] = await Promise.all(
    state.authMode === "worker"
      ? [loadArticlesFromWorker(), loadDocumentsFromWorker()]
      : [loadArticlesFromRepo(), loadDocumentsFromRepo()]
  );
  state.articles = articles;
  state.documents = documents;

  if (!state.selectedSlug && state.articles.length) {
    state.selectedSlug = state.articles[0].slug;
  }

  if (state.selectedSlug) {
    const stillExists = state.articles.some((article) => article.slug === state.selectedSlug);

    if (stillExists) {
      await selectArticle(state.selectedSlug);
    }
  }

  state.loading = false;
}

async function saveProof() {
  if (!state.selectedArticle) {
    return;
  }

  const errors = computeValidationErrors(state.selectedArticle.proof, state.documents);

  if (errors.length) {
    updateValidationPanel();
    setStatus("The proof still has validation errors. Fix them before saving.", "error");
    return;
  }

  if (state.authMode === "worker" && !state.sessionUser) {
    setStatus("Sign in with GitHub before saving proof changes.", "error");
    return;
  }

  if (state.authMode !== "worker" && !state.token) {
    setStatus("A GitHub token is required to save proof changes.", "error");
    return;
  }

  state.saving = true;
  render();

  try {
    if (state.authMode === "worker") {
      await workerJson("/api/proof/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug: state.selectedArticle.slug,
          proof: serializeProof(state.selectedArticle.proof)
        })
      });

      state.status = {
        message: `Saved proof for "${state.selectedArticle.title}".`,
        tone: "success"
      };
      state.saving = false;
      render();
      return;
    }

    const { content, sha } = await readRepoFile(state.selectedArticle.repo_path);
    const parsed = parseFrontmatter(content);
    parsed.data.proof = serializeProof(state.selectedArticle.proof);
    const nextContent = stringifyFrontmatter(parsed.data, parsed.body);

    await writeRepoTextFile(
      state.selectedArticle.repo_path,
      nextContent,
      `Update proof for "${state.selectedArticle.title}"`,
      sha
    );

    state.status = {
      message: `Saved proof for "${state.selectedArticle.title}".`,
      tone: "success"
    };
  } catch (error) {
    state.status = {
      message: `Could not save the proof. ${error.message || error}`,
      tone: "error"
    };
  }

  state.saving = false;
  render();
}

async function createSourceForAxiom(index) {
  const formState = state.newSourceForms[index] || {};

  if (!state.selectedArticle) {
    return;
  }

  if (state.authMode === "worker" && !state.sessionUser) {
    setStatus("Sign in with GitHub before creating source documents.", "error");
    return;
  }

  if (state.authMode !== "worker" && !state.token) {
    setStatus("A GitHub token is required to create source documents.", "error");
    return;
  }

  if (!(formState.title || "").trim() || !formState.file || !(formState.description || "").trim()) {
    setStatus("New source documents need a title, file, and description.", "error");
    return;
  }

  if (!(formState.obtained || "").trim() || !(formState.source_method || "").trim()) {
    setStatus("New source documents need an obtained date and source method.", "error");
    return;
  }

  try {
    if (state.authMode === "worker") {
      const file = formState.file;
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const payload = await workerJson("/api/proof/create-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: formState.title.trim(),
          description: formState.description.trim(),
          obtained: formState.obtained,
          source_method: formState.source_method.trim(),
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_base64: bytesToBase64(fileBytes)
        })
      });

      const documentRecord = payload.document;
      const documentUrl = documentRecord.url;
      state.documents = sortDocuments([documentRecord, ...state.documents]);

      const axiom = state.selectedArticle.proof.axioms[index];
      axiom.sources = dedupeSources([...(axiom.sources || []), { document_url: documentUrl }]);
      axiom.no_source_needed = false;
      delete state.newSourceForms[index];

      updateValidationPanel();
      setStatus(`Created and attached "${formState.title.trim()}".`, "success");
      return;
    }

    const baseSlug = slugify(formState.title);
    const slug = ensureUniqueSlug(baseSlug);
    const extension = inferExtension(formState.file);
    const assetPath = `${state.config.document_asset_path}${slug}.${extension}`;
    const documentPath = `${state.config.document_content_path}${slug}.md`;
    const fileUrl = `/documents/${slug}.${extension}`;
    const fileBytes = new Uint8Array(await formState.file.arrayBuffer());

    await writeRepoBinaryFile(assetPath, fileBytes, `Add source file "${formState.title}"`);

    const documentFrontmatter = yaml.dump(
      {
        title: formState.title.trim(),
        file: fileUrl,
        description: formState.description.trim(),
        obtained: formState.obtained,
        source_method: formState.source_method.trim()
      },
      {
        lineWidth: 1000,
        noRefs: true,
        sortKeys: false
      }
    );

    await writeRepoTextFile(
      documentPath,
      `---\n${documentFrontmatter}---\n`,
      `Add source document "${formState.title}"`,
      undefined
    );

    const documentUrl = `/documents/${slug}/`;
    state.documents = [
      {
        slug,
        title: formState.title.trim(),
        description: formState.description.trim(),
        obtained: formState.obtained,
        source_method: formState.source_method.trim(),
        url: documentUrl,
        file_url: fileUrl
      },
      ...state.documents
    ].sort((left, right) => left.title.localeCompare(right.title));

    const axiom = state.selectedArticle.proof.axioms[index];
    axiom.sources = dedupeSources([...(axiom.sources || []), { document_url: documentUrl }]);
    axiom.no_source_needed = false;
    delete state.newSourceForms[index];

    updateValidationPanel();
    setStatus(`Created and attached "${formState.title.trim()}".`, "success");
  } catch (error) {
    setStatus(`Could not create the source document. ${error.message || error}`, "error");
  }
}

function handleInput(event) {
  const proofField = event.target.dataset.proofField;
  const axiomField = event.target.dataset.axiomField;
  const logicField = event.target.dataset.logicField;
  const articleFilter = event.target.dataset.ui;
  const sourceSearch = event.target.dataset.sourceSearch;
  const newSourceField = event.target.dataset.newSourceField;

  if (articleFilter === "article-filter") {
    state.articleFilter = event.target.value;
    render();
    return;
  }

  if (articleFilter === "token-draft") {
    state.tokenDraft = event.target.value;
    return;
  }

  if (!state.selectedArticle) {
    return;
  }

  if (proofField) {
    state.selectedArticle.proof[proofField] = event.target.value;
    updateValidationPanel();
    return;
  }

  if (axiomField) {
    const axiom = state.selectedArticle.proof.axioms[Number(event.target.dataset.axiomIndex)];

    if (!axiom) {
      return;
    }

    if (axiomField === "no_source_needed") {
      axiom.no_source_needed = event.target.checked;
      if (axiom.no_source_needed) {
        axiom.sources = [];
      }
      render();
      return;
    }

    axiom[axiomField] = event.target.value;
    updateValidationPanel();
    return;
  }

  if (logicField) {
    const entry = state.selectedArticle.proof.logic[Number(event.target.dataset.logicIndex)];

    if (entry) {
      entry[logicField] = event.target.value;
      updateValidationPanel();
    }
    return;
  }

  if (sourceSearch != null) {
    state.sourceSearches[Number(sourceSearch)] = event.target.value;
    render();
    return;
  }

  if (newSourceField) {
    const index = Number(event.target.dataset.newSourceIndex);
    const formState = (state.newSourceForms[index] ||= {});

    if (newSourceField === "file") {
      formState.file = event.target.files?.[0] || null;
    } else {
      formState[newSourceField] = event.target.value;
    }
  }
}

function handleClick(event) {
  const actionTarget = event.target.closest("[data-action]");

  if (!actionTarget) {
    return;
  }

  const { action } = actionTarget.dataset;

  if (action === "select-article") {
    selectArticle(actionTarget.dataset.slug);
    return;
  }

  if (action === "refresh-data") {
    loadDeskData()
      .then(() => setStatus("Reloaded article and document data.", "success"))
      .catch((error) => setStatus(`Could not reload desk data. ${error.message || error}`, "error"));
    return;
  }

  if (action === "worker-logout") {
    workerRequest("/proof/logout", {
      method: "POST"
    })
      .then(async () => {
        state.sessionUser = null;
        state.articles = [];
        state.documents = [];
        state.selectedSlug = "";
        state.selectedArticle = null;
        setStatus("Signed out of the Proof Desk.", "success");
      })
      .catch((error) => setStatus(`Could not sign out. ${error.message || error}`, "error"));
    return;
  }

  if (action === "save-token") {
    if (!looksLikeToken(state.tokenDraft || "")) {
      setStatus("That does not look like a GitHub token yet.", "error");
      return;
    }

    state.token = state.tokenDraft.trim();
    state.tokenSource = "saved-token";
    sessionStorage.setItem(PROOF_TOKEN_KEY, state.token);
    localStorage.removeItem(PROOF_TOKEN_KEY);
    loadDeskData()
      .then(() => setStatus("Stored the GitHub token and loaded the Proof Desk.", "success"))
      .catch((error) => setStatus(`Stored the token, but could not load desk data. ${error.message || error}`, "error"));
    return;
  }

  if (action === "clear-token") {
    state.token = "";
    state.tokenDraft = "";
    state.tokenSource = "";
    sessionStorage.removeItem(PROOF_TOKEN_KEY);
    localStorage.removeItem(PROOF_TOKEN_KEY);
    state.articles = [];
    state.documents = [];
    state.selectedSlug = "";
    state.selectedArticle = null;
    setStatus("Cleared the saved GitHub token.", "success");
    return;
  }

  if (action === "save-proof") {
    saveProof();
    return;
  }

  if (!state.selectedArticle) {
    return;
  }

  if (action === "add-axiom") {
    state.selectedArticle.proof.axioms.push(defaultAxiom());
    render();
    return;
  }

  if (action === "remove-axiom") {
    state.selectedArticle.proof.axioms.splice(Number(actionTarget.dataset.axiomIndex), 1);
    if (!state.selectedArticle.proof.axioms.length) {
      state.selectedArticle.proof.axioms.push(defaultAxiom());
    }
    render();
    return;
  }

  if (action === "add-inference") {
    state.selectedArticle.proof.logic.push(defaultInference());
    render();
    return;
  }

  if (action === "remove-inference") {
    state.selectedArticle.proof.logic.splice(Number(actionTarget.dataset.logicIndex), 1);
    if (!state.selectedArticle.proof.logic.length) {
      state.selectedArticle.proof.logic.push(defaultInference());
    }
    render();
    return;
  }

  if (action === "attach-source") {
    const axiom = state.selectedArticle.proof.axioms[Number(actionTarget.dataset.axiomIndex)];

    if (!axiom) {
      return;
    }

    axiom.sources = dedupeSources([...(axiom.sources || []), { document_url: actionTarget.dataset.documentUrl }]);
    axiom.no_source_needed = false;
    render();
    return;
  }

  if (action === "remove-source") {
    const axiom = state.selectedArticle.proof.axioms[Number(actionTarget.dataset.axiomIndex)];

    if (!axiom) {
      return;
    }

    axiom.sources = (axiom.sources || []).filter((source) => source.document_url !== actionTarget.dataset.documentUrl);
    render();
    return;
  }

  if (action === "create-source") {
    createSourceForAxiom(Number(actionTarget.dataset.axiomIndex));
  }
}

async function init() {
  try {
    localStorage.removeItem(PROOF_TOKEN_KEY);
    const detected = detectStoredToken();
    state.token = detected.token;
    state.tokenSource = detected.source;
    state.tokenDraft = detected.token;
    state.authMode = "token";
    await loadDeskData();
    render();
  } catch (error) {
    state.status = {
      message: `Could not initialize the Proof Desk. ${error.message || error}`,
      tone: "error"
    };
    state.loading = false;
    render();
  }
}

root.addEventListener("click", handleClick);
root.addEventListener("input", handleInput);
root.addEventListener("change", handleInput);

init();
