const root = document.getElementById("editor-desk-root");
const EDITOR_UI_STATE_KEY = "dj-writer-desk-ui";

const state = {
  config: null,
  loading: true,
  status: null,
  sessionUser: null,
  articles: [],
  authors: [],
  documents: [],
  users: [],
  articleFilter: "",
  selectedSlug: "",
  selectedArticle: null,
  selectedArticleLoading: false,
  savingArticle: false,
  savingProof: false,
  loginDraft: {
    email: "",
    password: ""
  },
  newUserForm: {
    name: "",
    email: "",
    role: "writer",
    password: ""
  },
  userEdits: {},
  sourceSearches: {},
  newSourceForms: {},
  initialArticleSnapshot: "",
  initialProofSnapshot: ""
};

function readUiState() {
  try {
    return JSON.parse(sessionStorage.getItem(EDITOR_UI_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistUiState() {
  try {
    sessionStorage.setItem(
      EDITOR_UI_STATE_KEY,
      JSON.stringify({
        articleFilter: state.articleFilter || "",
        selectedSlug: state.selectedArticle?.isNew ? "" : state.selectedSlug || ""
      })
    );
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

function restoreUiState() {
  const stored = readUiState();
  state.articleFilter = typeof stored.articleFilter === "string" ? stored.articleFilter : "";
  state.selectedSlug = typeof stored.selectedSlug === "string" ? stored.selectedSlug : "";
}

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

function padNumber(value) {
  return value.toString().padStart(2, "0");
}

function dateToOffsetIso(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = padNumber(Math.floor(absoluteOffset / 60));
  const offsetRemainder = padNumber(absoluteOffset % 60);

  return [
    `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`,
    `T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:00`,
    `${sign}${offsetHours}:${offsetRemainder}`
  ].join("");
}

function isoToLocalInput(value = "") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(
    date.getHours()
  )}:${padNumber(date.getMinutes())}`;
}

function localInputToIso(value = "") {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateToOffsetIso(date);
}

function setStatus(message, tone = "info") {
  state.status = {
    message,
    tone
  };
  render();
}

function statusMarkup() {
  if (!state.status) {
    return "";
  }

  return `
    <div class="editor-status" data-tone="${escapeHtml(state.status.tone || "info")}" role="status" aria-live="polite">
      ${escapeHtml(state.status.message || "")}
    </div>
  `;
}

function sortArticles(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return rightTime - leftTime || (left.title || "").localeCompare(right.title || "");
  });
}

function sortDocuments(items = []) {
  return [...items].sort((left, right) => (left.title || "").localeCompare(right.title || ""));
}

function sortAuthors(items = []) {
  return [...items].sort((left, right) => (left.name || "").localeCompare(right.name || ""));
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

function defaultArticle() {
  return {
    isNew: true,
    slug: "",
    title: "",
    kicker: "",
    description: "",
    author: state.authors[0]?.slug || "",
    date: dateToOffsetIso(new Date()),
    tags: [],
    featured_image: "",
    body: "",
    url: "",
    repo_path: "",
    proof: normalizeProof({})
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

function normalizeArticle(rawArticle = {}) {
  return {
    isNew: Boolean(rawArticle.isNew),
    slug: rawArticle.slug || "",
    title: rawArticle.title || "",
    kicker: rawArticle.kicker || "",
    description: rawArticle.description || "",
    author: rawArticle.author || "",
    date: rawArticle.date || "",
    tags: Array.isArray(rawArticle.tags)
      ? rawArticle.tags.filter((tag) => normalizeWhitespace(tag))
      : normalizeWhitespace(rawArticle.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
    featured_image: rawArticle.featured_image || "",
    body: rawArticle.body || "",
    url: rawArticle.url || (rawArticle.slug ? `/articles/${rawArticle.slug}/` : ""),
    repo_path: rawArticle.repo_path || "",
    proof: normalizeProof(rawArticle.proof || {})
  };
}

function serializeArticle(article = {}) {
  return {
    slug: slugify(article.slug || article.title || ""),
    title: (article.title || "").trim(),
    kicker: (article.kicker || "").trim(),
    description: (article.description || "").trim(),
    author: (article.author || "").trim(),
    date: (article.date || "").trim(),
    tags: (article.tags || []).map((tag) => tag.trim()).filter(Boolean),
    featured_image: (article.featured_image || "").trim(),
    body: article.body || ""
  };
}

function articleSnapshot(article = state.selectedArticle) {
  return article ? JSON.stringify(serializeArticle(article)) : "";
}

function proofSnapshot(article = state.selectedArticle) {
  return article ? JSON.stringify(serializeProof(article.proof || {})) : "";
}

function syncArticleBaseline(article = state.selectedArticle) {
  state.initialArticleSnapshot = articleSnapshot(article);
}

function syncProofBaseline(article = state.selectedArticle) {
  state.initialProofSnapshot = proofSnapshot(article);
}

function syncSelectedArticleBaselines(article = state.selectedArticle) {
  syncArticleBaseline(article);
  syncProofBaseline(article);
}

function hasUnsavedStoryChanges() {
  return Boolean(state.selectedArticle) && articleSnapshot() !== state.initialArticleSnapshot;
}

function hasUnsavedProofChanges() {
  return Boolean(state.selectedArticle) && proofSnapshot() !== state.initialProofSnapshot;
}

function hasUnsavedEditorChanges() {
  return hasUnsavedStoryChanges() || hasUnsavedProofChanges();
}

function unsavedChangeLabel() {
  const parts = [];

  if (hasUnsavedStoryChanges()) {
    parts.push("story");
  }

  if (hasUnsavedProofChanges()) {
    parts.push("proof");
  }

  return parts.join(" and ");
}

function confirmDiscardChanges(actionLabel = "continue") {
  if (!hasUnsavedEditorChanges()) {
    return true;
  }

  return window.confirm(`You have unsaved ${unsavedChangeLabel()} changes. Discard them and ${actionLabel}?`);
}

function computeArticleErrors(article = {}) {
  const errors = [];

  if (!slugify(article.slug || article.title || "")) {
    errors.push("Article slug is required.");
  }

  if (!(article.title || "").trim()) {
    errors.push("Headline is required.");
  }

  if (!(article.description || "").trim()) {
    errors.push("Lede is required.");
  }

  if (!(article.author || "").trim()) {
    errors.push("Author is required.");
  }

  if (!(article.date || "").trim()) {
    errors.push("Publication date is required.");
  }

  return errors;
}

function computeProofErrors(proof = {}, documents = state.documents) {
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

      const sourceCount = Array.isArray(axiom.sources)
        ? axiom.sources.filter((entry) => entry?.document_url).length
        : 0;

      if (axiom.no_source_needed && sourceCount > 0) {
        errors.push(`Axiom ${index + 1} cannot be source-free and source-backed at the same time.`);
      }

      if (!axiom.no_source_needed && sourceCount === 0) {
        errors.push(`Axiom ${index + 1} needs at least one linked source or a no-source flag.`);
      }

      for (const source of axiom.sources || []) {
        if (source?.document_url && !knownDocuments.some((document) => document.url === source.document_url)) {
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
    const haystack = [
      article.title,
      article.description,
      article.slug,
      article.author
    ]
      .join(" ")
      .toLowerCase();
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

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function editorApiBaseUrl() {
  return (state.config?.editor_api_base_url || "").replace(/\/+$/, "");
}

function editorApiUrl(pathname = "") {
  return `${editorApiBaseUrl()}${pathname}`;
}

async function workerRequest(pathname, options = {}) {
  const response = await fetch(editorApiUrl(pathname), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status}).`);
  }

  return response;
}

async function workerJson(pathname, options = {}) {
  const response = await workerRequest(pathname, options);
  return response.json();
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

async function loadSession() {
  try {
    const response = await fetch(editorApiUrl("/api/editor/session"), {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      state.sessionUser = null;
      return;
    }

    if (!response.ok) {
      throw new Error("Could not load session.");
    }

    const payload = await response.json();
    state.sessionUser = payload.user || null;
  } catch {
    state.sessionUser = null;
  }
}

async function loadArticles() {
  const payload = await workerJson("/api/editor/articles");
  return sortArticles(Array.isArray(payload.articles) ? payload.articles : []);
}

async function loadAuthors() {
  const payload = await workerJson("/api/editor/authors");
  return sortAuthors(Array.isArray(payload.authors) ? payload.authors : []);
}

async function loadDocuments() {
  const payload = await workerJson("/api/editor/documents");
  return sortDocuments(Array.isArray(payload.documents) ? payload.documents : []);
}

async function loadUsers() {
  const payload = await workerJson("/api/editor/admin/users");
  return Array.isArray(payload.users) ? payload.users : [];
}

async function loadSelectedArticleContent() {
  if (!state.selectedArticle || state.selectedArticle.isNew) {
    return;
  }

  const payload = await workerJson(`/api/editor/article?slug=${encodeURIComponent(state.selectedArticle.slug)}`);
  state.selectedArticle = normalizeArticle(payload.article || {});
}

function mergeArticleIntoList(article) {
  const summary = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    author: article.author,
    date: article.date,
    url: article.url || `/articles/${article.slug}/`,
    repo_path: article.repo_path || "",
    proof: article.proof || null
  };
  const next = state.articles.filter((entry) => entry.slug !== summary.slug);
  next.push(summary);
  state.articles = sortArticles(next);
}

function renderLoginView() {
  root.innerHTML = `
    <div class="editor-shell">
      <div class="editor-frame editor-home">
        <section class="editor-hero">
          <p class="editor-kicker">Writer desk</p>
          <h1 class="editor-title">Proof-first editing without GitHub accounts.</h1>
          <p class="editor-copy">
            Sign in with the publication login the admin assigned you. The desk saves the same article files, proof
            records, and source documents already used by the site.
          </p>
        </section>

        <section class="editor-card" style="max-width: 34rem;">
          <p class="editor-kicker">Editorial login</p>
          <h2>Assigned writer account</h2>
          <p>Use the email and password created for you by the publication admin.</p>
          ${statusMarkup()}
          <label class="editor-field">
            <span class="editor-label">Email</span>
            <input class="editor-input" type="email" value="${escapeHtml(state.loginDraft.email || "")}" data-ui="login-email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" />
          </label>
          <label class="editor-field">
            <span class="editor-label">Password</span>
            <input class="editor-input" type="password" value="${escapeHtml(state.loginDraft.password || "")}" data-ui="login-password" autocomplete="current-password" />
          </label>
          <div class="editor-actions" style="margin-top: 1rem;">
            <button class="editor-button" type="button" data-action="login">Sign in</button>
            <a class="editor-button-ghost" href="/admin/">Back to Editorial Desk</a>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderArticleCard(article) {
  const isSelected = !state.selectedArticle?.isNew && state.selectedSlug === article.slug;
  const proof = hasMeaningfulValue(article.proof) ? normalizeProof(article.proof || {}) : null;
  const sourceCount = proof ? countUniqueSources(proof) : 0;
  const axiomCount = proof ? proof.axioms.length : 0;

  return `
    <button class="editor-list-card" type="button" data-action="select-article" data-slug="${escapeHtml(article.slug)}" data-selected="${isSelected ? "true" : "false"}">
      <p class="editor-kicker">${escapeHtml(article.date ? new Date(article.date).toLocaleDateString("en-US") : "Draft")}</p>
      <h3>${escapeHtml(article.title || article.slug)}</h3>
      <p>${escapeHtml(article.description || "")}</p>
      <div class="editor-pill-row">
        <span class="editor-pill">${axiomCount} axioms</span>
        <span class="editor-pill">${sourceCount} docs</span>
      </div>
    </button>
  `;
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

function renderArticleValidationPanel() {
  if (!state.selectedArticle) {
    return "";
  }

  const errors = computeArticleErrors(state.selectedArticle);

  if (!errors.length) {
    return `
      <div class="editor-status" data-tone="success">
        Story fields are ready to save.
      </div>
    `;
  }

  return `
    <div class="editor-status" data-tone="error">
      <strong>Story still needs work.</strong>
      <ul class="editor-errors">
        ${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderProofValidationPanel() {
  if (!state.selectedArticle) {
    return "";
  }

  const errors = computeProofErrors(state.selectedArticle.proof, state.documents);

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

function renderAuthorField() {
  if (!state.authors.length) {
    return `
      <label class="editor-field" style="flex: 1 1 16rem;">
        <span class="editor-label">Author</span>
        <input class="editor-input" type="text" value="${escapeHtml(state.selectedArticle?.author || "")}" data-article-field="author" />
      </label>
    `;
  }

  return `
    <label class="editor-field" style="flex: 1 1 16rem;">
      <span class="editor-label">Author</span>
      <select class="editor-select" data-article-field="author">
        <option value="">Select author</option>
        ${state.authors
          .map(
            (author) => `
              <option value="${escapeHtml(author.slug)}" ${state.selectedArticle?.author === author.slug ? "selected" : ""}>
                ${escapeHtml(author.name)}${author.role ? ` - ${escapeHtml(author.role)}` : ""}
              </option>
            `
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderStorySection() {
  const article = state.selectedArticle;

  return `
    <section class="editor-panel editor-section">
      <div class="editor-panel__header">
        <div>
          <p class="editor-kicker">Story</p>
          <h2>${escapeHtml(article.isNew ? "New article draft" : article.title || article.slug)}</h2>
        </div>
        <div class="editor-actions">
          ${article.url ? `<a class="editor-button-ghost" href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">Open article</a>` : ""}
          <button class="editor-button" type="button" data-action="save-story" ${state.savingArticle ? "disabled" : ""}>
            ${state.savingArticle ? "Saving…" : article.isNew ? "Create article" : "Save story"}
          </button>
        </div>
      </div>

      ${renderArticleValidationPanel()}

      <div class="editor-block">
        <label class="editor-field">
          <span class="editor-label">Slug</span>
          <input class="editor-input" type="text" value="${escapeHtml(article.slug || "")}" data-article-field="slug" autocapitalize="none" autocomplete="off" spellcheck="false" ${article.isNew ? "" : "readonly"} />
        </label>

        <div class="editor-row">
          <label class="editor-field" style="flex: 1 1 26rem;">
            <span class="editor-label">Headline</span>
            <input class="editor-input" type="text" value="${escapeHtml(article.title || "")}" data-article-field="title" />
          </label>
          <label class="editor-field" style="flex: 1 1 12rem;">
            <span class="editor-label">Kicker</span>
            <input class="editor-input" type="text" value="${escapeHtml(article.kicker || "")}" data-article-field="kicker" />
          </label>
        </div>

        <label class="editor-field">
          <span class="editor-label">Lede</span>
          <textarea class="editor-textarea" data-article-field="description">${escapeHtml(article.description || "")}</textarea>
        </label>

        <div class="editor-row">
          ${renderAuthorField()}
          <label class="editor-field" style="flex: 1 1 16rem;">
            <span class="editor-label">Publication date</span>
            <input class="editor-input" type="datetime-local" value="${escapeHtml(isoToLocalInput(article.date || ""))}" data-article-field="date" />
          </label>
        </div>

        <div class="editor-row">
          <label class="editor-field" style="flex: 1 1 20rem;">
            <span class="editor-label">Tags</span>
            <input class="editor-input" type="text" value="${escapeHtml((article.tags || []).join(", "))}" data-article-field="tags" placeholder="crime, elections" />
          </label>
          <label class="editor-field" style="flex: 1 1 20rem;">
            <span class="editor-label">Featured image</span>
            <input class="editor-input" type="text" value="${escapeHtml(article.featured_image || "")}" data-article-field="featured_image" placeholder="/assets/images/uploads/example.jpg" autocapitalize="none" autocomplete="off" spellcheck="false" />
          </label>
        </div>

        <label class="editor-field">
          <span class="editor-label">Body</span>
          <textarea class="editor-textarea" style="min-height: 24rem;" data-article-field="body">${escapeHtml(article.body || "")}</textarea>
        </label>
      </div>
    </section>
  `;
}

function renderUserCard(user) {
  const draft = state.userEdits[user.email] || {};
  const nextName = draft.name ?? user.name ?? "";
  const nextRole = draft.role ?? user.role ?? "writer";
  const nextActive = draft.active ?? user.active ?? true;
  const nextPassword = draft.password ?? "";

  return `
    <details class="editor-details">
      <summary>${escapeHtml(user.name || user.email)} · ${escapeHtml(user.role)}${user.active ? "" : " · paused"}${user.bootstrap ? " · bootstrap" : ""}</summary>
      <div class="editor-details__body">
        <label class="editor-field">
          <span class="editor-label">Name</span>
          <input class="editor-input" type="text" value="${escapeHtml(nextName)}" data-user-email="${escapeHtml(user.email)}" data-user-field="name" ${user.bootstrap ? "disabled" : ""} />
        </label>
        <label class="editor-field">
          <span class="editor-label">Email</span>
          <input class="editor-input" type="text" value="${escapeHtml(user.email)}" disabled />
        </label>
        <label class="editor-field">
          <span class="editor-label">Role</span>
          <select class="editor-select" data-user-email="${escapeHtml(user.email)}" data-user-field="role" ${user.bootstrap ? "disabled" : ""}>
            ${["writer", "editor", "publisher", "admin"]
              .map(
                (role) => `
                  <option value="${role}" ${nextRole === role ? "selected" : ""}>${role}</option>
                `
              )
              .join("")}
          </select>
        </label>
        <label class="editor-checkbox">
          <input type="checkbox" data-user-email="${escapeHtml(user.email)}" data-user-field="active" ${nextActive ? "checked" : ""} ${user.bootstrap ? "disabled" : ""} />
          <span>${user.bootstrap ? "Bootstrap admin is always active and controlled by Worker secrets." : "Account is active."}</span>
        </label>
        ${
          user.bootstrap
            ? ""
            : `
              <label class="editor-field">
                <span class="editor-label">Reset assigned password</span>
                <input class="editor-input" type="text" value="${escapeHtml(nextPassword)}" data-user-email="${escapeHtml(user.email)}" data-user-field="password" placeholder="Leave blank to keep current password" />
              </label>
              <div class="editor-actions" style="margin-top: 1rem;">
                <button class="editor-button-secondary" type="button" data-action="save-user" data-user-email="${escapeHtml(user.email)}">
                  Save account
                </button>
              </div>
            `
        }
      </div>
    </details>
  `;
}

function renderAdminPanel() {
  if (state.sessionUser?.role !== "admin") {
    return "";
  }

  return `
    <section class="editor-panel">
      <div class="editor-panel__header">
        <div>
          <p class="editor-kicker">Admin</p>
          <h2>Assigned logins</h2>
        </div>
        <span class="editor-muted">${state.users.length} accounts</span>
      </div>

      <details class="editor-details" open>
        <summary>Create login</summary>
        <div class="editor-details__body">
          <label class="editor-field">
            <span class="editor-label">Name</span>
            <input class="editor-input" type="text" value="${escapeHtml(state.newUserForm.name || "")}" data-new-user-field="name" autocomplete="off" />
          </label>
          <label class="editor-field">
            <span class="editor-label">Email</span>
            <input class="editor-input" type="email" value="${escapeHtml(state.newUserForm.email || "")}" data-new-user-field="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" />
          </label>
          <label class="editor-field">
            <span class="editor-label">Role</span>
            <select class="editor-select" data-new-user-field="role">
              ${["writer", "editor", "publisher", "admin"]
                .map(
                  (role) => `
                    <option value="${role}" ${state.newUserForm.role === role ? "selected" : ""}>${role}</option>
                  `
                )
                .join("")}
            </select>
          </label>
          <label class="editor-field">
            <span class="editor-label">Assigned password</span>
            <input class="editor-input" type="text" value="${escapeHtml(state.newUserForm.password || "")}" data-new-user-field="password" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
          </label>
          <div class="editor-actions" style="margin-top: 1rem;">
            <button class="editor-button-secondary" type="button" data-action="create-user">Create login</button>
          </div>
        </div>
      </details>

      <div class="editor-section" style="margin-top: 1rem;">
        ${state.users.length ? state.users.map((user) => renderUserCard(user)).join("") : `<div class="editor-empty">No editor accounts yet.</div>`}
      </div>
    </section>
  `;
}

function renderSelectedArticle() {
  if (!state.selectedArticle) {
    return `
      <section class="editor-panel">
        <h2>Pick an article</h2>
        <p>Choose an article from the sidebar or start a new one.</p>
      </section>
    `;
  }

  if (state.selectedArticleLoading) {
    return `
      <section class="editor-panel">
        <h2>${escapeHtml(state.selectedArticle.title || state.selectedArticle.slug || "Loading article")}</h2>
        <p>Loading the article from the repository so the Writer Desk can edit the current story and proof.</p>
      </section>
    `;
  }

  const proof = state.selectedArticle.proof;
  const uniqueSourceCount = countUniqueSources(proof);

  return `
    ${renderStorySection()}

    <section class="editor-panel editor-section">
      <div class="editor-panel__header">
        <div>
          <p class="editor-kicker">Proof</p>
          <h2>Issue, axioms, inferences, and conclusion</h2>
        </div>
        <div class="editor-actions">
          <button class="editor-button" type="button" data-action="save-proof" ${state.savingProof ? "disabled" : ""}>
            ${state.savingProof ? "Saving…" : "Save proof"}
          </button>
        </div>
      </div>

      <div class="editor-pill-row">
        <span class="editor-pill">${proof.axioms.length} axioms</span>
        <span class="editor-pill">${proof.logic.length} inferences</span>
        <span class="editor-pill">${uniqueSourceCount} linked documents</span>
      </div>

      ${renderProofValidationPanel()}

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
  persistUiState();
  document.title = "Democratic Justice Writer Desk";

  if (state.loading) {
    root.innerHTML = `
      <div class="editor-shell">
        <div class="editor-frame editor-home">
          <section class="editor-card">
            <p class="editor-kicker">Writer desk</p>
            <h2>Loading editor…</h2>
            <p>Checking the publication session and loading the editorial data.</p>
          </section>
        </div>
      </div>
    `;
    return;
  }

  if (!state.sessionUser) {
    renderLoginView();
    return;
  }

  const signedInLabel = state.sessionUser.name
    ? `${state.sessionUser.name} (${state.sessionUser.role})`
    : `${state.sessionUser.email} (${state.sessionUser.role})`;
  const hasUnsavedChanges = hasUnsavedEditorChanges();
  const toolbarStatus = !state.selectedArticle
    ? "No story selected"
    : hasUnsavedChanges
      ? `${unsavedChangeLabel()} changes not saved`
      : "All changes saved";
  document.title = `${hasUnsavedChanges ? "* " : ""}Democratic Justice Writer Desk`;

  root.innerHTML = `
    <div class="editor-shell">
      <div class="editor-frame editor-app">
        <div class="editor-toolbar">
          <div class="editor-toolbar__nav">
            <a class="editor-button-ghost" href="/admin/">Back to Editorial Desk</a>
            <a class="editor-button-ghost" href="/admin/proof/">Open Legacy Proof Desk</a>
            <a class="editor-button-ghost" href="/admin/cms/">Open Legacy Content Desk</a>
          </div>
          <div class="editor-toolbar__actions">
            <div class="editor-toolbar__status" data-dirty="${hasUnsavedChanges ? "true" : "false"}" role="status" aria-live="polite">
              <strong>${escapeHtml(toolbarStatus)}</strong>
              <span>Press Cmd/Ctrl+S to save</span>
            </div>
            <button class="editor-button-secondary" type="button" data-action="refresh-data">Reload desk data</button>
          </div>
        </div>

        ${statusMarkup()}

        <div class="editor-layout">
          <aside class="editor-sidebar">
            <section class="editor-panel">
              <div class="editor-panel__header">
                <div>
                  <p class="editor-kicker">Session</p>
                  <h2>Editorial access</h2>
                </div>
              </div>
              <p>Signed in as ${escapeHtml(signedInLabel)}.</p>
              <p class="editor-muted">This desk writes article files, proof records, and source documents to GitHub on behalf of the publication.</p>
              <div class="editor-actions" style="margin-top: 1rem;">
                <button class="editor-button-ghost" type="button" data-action="logout">Sign out</button>
              </div>
            </section>

            <section class="editor-panel">
              <div class="editor-panel__header">
                <div>
                  <p class="editor-kicker">Article picker</p>
                  <h2>Stories</h2>
                </div>
                <span class="editor-muted">${state.articles.length} total</span>
              </div>
              <div class="editor-actions" style="margin-top: 1rem;">
                <button class="editor-button-secondary" type="button" data-action="new-article">New article</button>
              </div>
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

            ${renderAdminPanel()}
          </aside>

          <main class="editor-main">
            ${renderSelectedArticle()}
          </main>
        </div>
      </div>
    </div>
  `;
}

async function loadDeskData({ selectFirst = true } = {}) {
  const [articles, authors, documents, users] = await Promise.all([
    loadArticles(),
    loadAuthors(),
    loadDocuments(),
    state.sessionUser?.role === "admin" ? loadUsers() : Promise.resolve([])
  ]);

  state.articles = articles;
  state.authors = authors;
  state.documents = documents;
  state.users = users;

  if (state.selectedArticle?.isNew) {
    return;
  }

  if (!state.selectedSlug && selectFirst && state.articles.length) {
    state.selectedSlug = state.articles[0].slug;
  }

  if (state.selectedSlug) {
    const stillExists = state.articles.some((article) => article.slug === state.selectedSlug);

    if (stillExists) {
      await selectArticle(state.selectedSlug);
    } else {
      state.selectedSlug = "";
      state.selectedArticle = null;

      if (selectFirst && state.articles.length) {
        state.selectedSlug = state.articles[0].slug;
        await selectArticle(state.selectedSlug);
      }
    }
  }
}

async function selectArticle(slug) {
  const article = state.articles.find((entry) => entry.slug === slug);

  if (!article) {
    return;
  }

  state.selectedSlug = slug;
  state.selectedArticleLoading = true;
  state.selectedArticle = normalizeArticle({
    ...article,
    body: "",
    proof: article.proof || {}
  });
  state.sourceSearches = {};
  state.newSourceForms = {};
  syncSelectedArticleBaselines();
  render();

  try {
    await loadSelectedArticleContent();
  } catch (error) {
    state.status = {
      message: `Could not load the article. ${error.message || error}`,
      tone: "error"
    };
  }

  state.selectedArticleLoading = false;
  syncSelectedArticleBaselines();
  render();
}

function startNewArticle() {
  state.selectedSlug = "__new__";
  state.selectedArticleLoading = false;
  state.selectedArticle = defaultArticle();
  state.sourceSearches = {};
  state.newSourceForms = {};
  syncSelectedArticleBaselines();
  render();
}

async function login() {
  const email = normalizeWhitespace(state.loginDraft.email || "").toLowerCase();
  const password = state.loginDraft.password || "";

  if (!email || !password) {
    setStatus("Email and password are required.", "error");
    return;
  }

  try {
    await workerJson("/api/editor/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    state.loginDraft.password = "";
    await loadSession();
    await loadDeskData();
    setStatus("Signed in to the Writer Desk.", "success");
  } catch (error) {
    setStatus(`Could not sign in. ${error.message || error}`, "error");
  }
}

async function logout() {
  try {
    await workerRequest("/api/editor/logout", {
      method: "POST"
    });
    state.sessionUser = null;
    state.articles = [];
    state.authors = [];
    state.documents = [];
    state.users = [];
    state.selectedSlug = "";
    state.selectedArticle = null;
    setStatus("Signed out of the Writer Desk.", "success");
  } catch (error) {
    setStatus(`Could not sign out. ${error.message || error}`, "error");
  }
}

async function saveArticle() {
  if (!state.selectedArticle) {
    return;
  }

  const article = serializeArticle(state.selectedArticle);
  const errors = computeArticleErrors(article);

  if (errors.length) {
    setStatus("The story still has validation errors. Fix them before saving.", "error");
    return;
  }

  state.savingArticle = true;
  render();

  try {
    const payload = await workerJson("/api/editor/article/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        slug: article.slug,
        repo_path: state.selectedArticle.repo_path || "",
        article
      })
    });

    state.selectedArticle = normalizeArticle({
      ...(payload.article || article),
      proof: state.selectedArticle.proof
    });
    state.selectedArticle.isNew = false;
    state.selectedSlug = state.selectedArticle.slug;
    mergeArticleIntoList(state.selectedArticle);
    syncArticleBaseline();
    setStatus(`Saved "${state.selectedArticle.title}".`, "success");
  } catch (error) {
    setStatus(`Could not save the story. ${error.message || error}`, "error");
  }

  state.savingArticle = false;
  render();
}

async function saveProof() {
  if (!state.selectedArticle) {
    return;
  }

  if (state.selectedArticle.isNew || !state.selectedArticle.slug) {
    setStatus("Save the story once before saving proof changes.", "error");
    return;
  }

  const errors = computeProofErrors(state.selectedArticle.proof, state.documents);

  if (errors.length) {
    setStatus("The proof still has validation errors. Fix them before saving.", "error");
    return;
  }

  state.savingProof = true;
  render();

  try {
    await workerJson("/api/editor/proof/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        slug: state.selectedArticle.slug,
        proof: serializeProof(state.selectedArticle.proof)
      })
    });

    mergeArticleIntoList({
      ...state.selectedArticle,
      proof: serializeProof(state.selectedArticle.proof)
    });
    syncProofBaseline();
    setStatus(`Saved proof for "${state.selectedArticle.title}".`, "success");
  } catch (error) {
    setStatus(`Could not save the proof. ${error.message || error}`, "error");
  }

  state.savingProof = false;
  render();
}

async function createSourceForAxiom(index) {
  const formState = state.newSourceForms[index] || {};

  if (!state.selectedArticle) {
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
    const file = formState.file;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const payload = await workerJson("/api/editor/create-document", {
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

    setStatus(`Created and attached "${formState.title.trim()}".`, "success");
    render();
  } catch (error) {
    setStatus(`Could not create the source document. ${error.message || error}`, "error");
  }
}

async function createUser() {
  if (state.sessionUser?.role !== "admin") {
    return;
  }

  const payload = {
    name: normalizeWhitespace(state.newUserForm.name || ""),
    email: normalizeWhitespace(state.newUserForm.email || "").toLowerCase(),
    role: state.newUserForm.role || "writer",
    password: state.newUserForm.password || ""
  };

  if (!payload.name || !payload.email || !payload.password) {
    setStatus("New editor accounts need a name, email, role, and assigned password.", "error");
    return;
  }

  try {
    const response = await workerJson("/api/editor/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    state.users = [response.user, ...state.users.filter((user) => user.email !== response.user.email)];
    state.newUserForm = {
      name: "",
      email: "",
      role: "writer",
      password: ""
    };
    setStatus(`Created login for ${response.user.email}.`, "success");
  } catch (error) {
    setStatus(`Could not create the login. ${error.message || error}`, "error");
  }

  render();
}

async function saveUser(email) {
  if (state.sessionUser?.role !== "admin") {
    return;
  }

  const user = state.users.find((entry) => entry.email === email);
  const draft = state.userEdits[email] || {};

  if (!user) {
    return;
  }

  try {
    const response = await workerJson("/api/editor/admin/users/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        name: draft.name ?? user.name,
        role: draft.role ?? user.role,
        active: draft.active ?? user.active,
        password: draft.password || ""
      })
    });

    state.users = state.users.map((entry) => (entry.email === email ? response.user : entry));
    state.userEdits[email] = {};
    setStatus(`Updated ${email}.`, "success");
  } catch (error) {
    setStatus(`Could not update ${email}. ${error.message || error}`, "error");
  }

  render();
}

function handleInput(event) {
  const uiField = event.target.dataset.ui;
  const articleField = event.target.dataset.articleField;
  const proofField = event.target.dataset.proofField;
  const axiomField = event.target.dataset.axiomField;
  const logicField = event.target.dataset.logicField;
  const sourceSearch = event.target.dataset.sourceSearch;
  const newSourceField = event.target.dataset.newSourceField;
  const newUserField = event.target.dataset.newUserField;
  const userField = event.target.dataset.userField;

  if (uiField === "article-filter") {
    state.articleFilter = event.target.value;
    render();
    return;
  }

  if (uiField === "login-email") {
    state.loginDraft.email = event.target.value;
    return;
  }

  if (uiField === "login-password") {
    state.loginDraft.password = event.target.value;
    return;
  }

  if (newUserField) {
    state.newUserForm[newUserField] =
      newUserField === "role" ? event.target.value : event.target.value;
    return;
  }

  if (userField) {
    const email = event.target.dataset.userEmail;
    const draft = (state.userEdits[email] ||= {});

    if (userField === "active") {
      draft.active = event.target.checked;
    } else {
      draft[userField] = event.target.value;
    }
    return;
  }

  if (!state.selectedArticle) {
    return;
  }

  if (articleField) {
    if (articleField === "tags") {
      state.selectedArticle.tags = event.target.value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    } else if (articleField === "date") {
      state.selectedArticle.date = localInputToIso(event.target.value);
    } else {
      state.selectedArticle[articleField] = event.target.value;
    }
    return;
  }

  if (proofField) {
    state.selectedArticle.proof[proofField] = event.target.value;
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
    return;
  }

  if (logicField) {
    const entry = state.selectedArticle.proof.logic[Number(event.target.dataset.logicIndex)];

    if (entry) {
      entry[logicField] = event.target.value;
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

  if (action === "login") {
    login();
    return;
  }

  if (action === "logout") {
    if (!confirmDiscardChanges("sign out")) {
      return;
    }

    logout();
    return;
  }

  if (action === "refresh-data") {
    if (!confirmDiscardChanges("reload the desk")) {
      return;
    }

    loadDeskData()
      .then(() => setStatus("Reloaded editor data.", "success"))
      .catch((error) => setStatus(`Could not reload desk data. ${error.message || error}`, "error"));
    return;
  }

  if (action === "new-article") {
    if (state.selectedArticle?.isNew) {
      return;
    }

    if (!confirmDiscardChanges("start a new article")) {
      return;
    }

    startNewArticle();
    return;
  }

  if (action === "create-user") {
    createUser();
    return;
  }

  if (action === "save-user") {
    saveUser(actionTarget.dataset.userEmail);
    return;
  }

  if (action === "select-article") {
    const slug = actionTarget.dataset.slug;

    if (!slug || (slug === state.selectedSlug && !state.selectedArticle?.isNew)) {
      return;
    }

    if (!confirmDiscardChanges("open another article")) {
      return;
    }

    selectArticle(slug);
    return;
  }

  if (action === "save-story") {
    saveArticle();
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

function handleKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
    if (!state.selectedArticle) {
      return;
    }

    event.preventDefault();

    if (state.savingArticle || state.savingProof) {
      return;
    }

    const proofFieldTarget = event.target.closest(
      "[data-proof-field], [data-axiom-field], [data-logic-field], [data-source-search], [data-new-source-field]"
    );

    if (state.selectedArticle.isNew) {
      saveArticle();
      return;
    }

    if (proofFieldTarget || (!hasUnsavedStoryChanges() && hasUnsavedProofChanges())) {
      saveProof();
      return;
    }

    saveArticle();
  }

  if (!state.sessionUser && event.key === "Enter" && !event.shiftKey) {
    const loginTarget = event.target.closest("[data-ui=\"login-email\"], [data-ui=\"login-password\"]");

    if (!loginTarget) {
      return;
    }

    event.preventDefault();
    login();
  }
}

function handleBeforeUnload(event) {
  if (!hasUnsavedEditorChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

async function init() {
  try {
    restoreUiState();
    state.config = await fetchJson("/admin/editor/data/config.json");

    if (!editorApiBaseUrl()) {
      throw new Error("Missing editor_api_base_url for the Writer Desk.");
    }

    await loadSession();

    if (state.sessionUser) {
      await loadDeskData();
    }

    state.loading = false;
    render();
  } catch (error) {
    state.loading = false;
    state.status = {
      message: `Could not initialize the Writer Desk. ${error.message || error}`,
      tone: "error"
    };
    render();
  }
}

root.addEventListener("click", handleClick);
root.addEventListener("input", handleInput);
root.addEventListener("change", handleInput);
root.addEventListener("keydown", handleKeydown);
window.addEventListener("beforeunload", handleBeforeUnload);

init();
