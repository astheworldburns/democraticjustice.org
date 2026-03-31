const root = document.getElementById("proof-desk-root");
const PROOF_UI_STATE_KEY = "dj-proof-desk-ui";

const state = {
  config: null,
  articles: [],
  documents: [],
  sessionUser: null,
  articleFilter: "",
  selectedSlug: "",
  selectedArticle: null,
  selectedArticleLoading: false,
  sourceSearches: {},
  newSourceForms: {},
  status: null,
  loading: true,
  saving: false,
  initialProofSnapshot: ""
};

function readUiState() {
  try {
    return JSON.parse(sessionStorage.getItem(PROOF_UI_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistUiState() {
  try {
    sessionStorage.setItem(
      PROOF_UI_STATE_KEY,
      JSON.stringify({
        articleFilter: state.articleFilter || "",
        selectedSlug: state.selectedSlug || ""
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

function defaultAxiom() {
  return {
    premise: "",
    no_source_needed: false,
    sources: []
  };
}

function defaultTheorem() {
  return {
    id: "",
    step: "",
    references: ""
  };
}

function defaultPostulate() {
  return {
    id: "",
    fact: "",
    no_source_needed: false,
    sources: []
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
  const postulates = Array.isArray(rawProof.postulates)
    ? rawProof.postulates.map((entry) => ({
        id: entry?.id || "",
        fact: entry?.fact || "",
        no_source_needed: Boolean(entry?.no_source_needed),
        sources: normalizeSources(entry)
      }))
    : [];
  const theoremSource = Array.isArray(rawProof.theorems) && rawProof.theorems.length ? rawProof.theorems : rawProof.logic;
  const theorems = Array.isArray(theoremSource)
    ? theoremSource.map((entry) => ({
        id: entry?.id || "",
        step: entry?.step || "",
        references: entry?.references || ""
      }))
    : [];

  return {
    issue: rawProof?.issue || "",
    axioms: axioms.length ? axioms : [defaultAxiom()],
    postulates: postulates.length ? postulates : [],
    theorems: theorems.length ? theorems : [defaultTheorem()],
    qed: rawProof?.qed || rawProof?.conclusion || ""
  };
}

function serializeProof(proof = {}) {
  const next = {
    issue: (proof.issue || "").trim(),
    axioms: (proof.axioms || []).map((axiom) => ({
      id: (axiom.id || "").trim(),
      premise: (axiom.premise || "").trim(),
      sources: axiom.no_source_needed ? [] : dedupeSources(axiom.sources || []),
      no_source_needed: Boolean(axiom.no_source_needed)
    })),
    postulates: (proof.postulates || []).map((postulate) => ({
      id: (postulate.id || "").trim(),
      fact: (postulate.fact || "").trim(),
      sources: postulate.no_source_needed ? [] : dedupeSources(postulate.sources || []),
      no_source_needed: Boolean(postulate.no_source_needed)
    })),
    theorems: (proof.theorems || []).map((entry) => ({
      id: (entry.id || "").trim(),
      step: (entry.step || "").trim(),
      references: (entry.references || "").trim()
    })),
    qed: (proof.qed || "").trim()
  };

  return next;
}

function proofSnapshot(article = state.selectedArticle) {
  return article ? JSON.stringify(serializeProof(article.proof || {})) : "";
}

function syncProofBaseline(article = state.selectedArticle) {
  state.initialProofSnapshot = proofSnapshot(article);
}

function hasUnsavedProofChanges() {
  return Boolean(state.selectedArticle) && proofSnapshot() !== state.initialProofSnapshot;
}

function confirmDiscardChanges(actionLabel = "continue") {
  if (!hasUnsavedProofChanges()) {
    return true;
  }

  return window.confirm(`You have unsaved proof changes. Discard them and ${actionLabel}?`);
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
        if (!source?.document_url) {
          continue;
        }

        const linksToDocument = knownDocuments.some((document) => document.url === source.document_url);

        if (!linksToDocument && !isWebUrl(source.document_url)) {
          errors.push(`Axiom ${index + 1} links to a missing source document: ${source.document_url}`);
        }
      }
    });
  }

  if (!Array.isArray(proof.theorems) || proof.theorems.length === 0) {
    errors.push("At least one theorem is required.");
  } else {
    proof.theorems.forEach((entry, index) => {
      if (!(entry.step || "").trim()) {
        errors.push(`Theorem ${index + 1} needs text.`);
      }
    });
  }

  if (!(proof.qed || "").trim()) {
    errors.push("Q.E.D. is required.");
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

function isWebUrl(value = "") {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function redirectToAdmin() {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/admin/?next=${encodeURIComponent(next)}`);
}

async function workerRequest(pathname, options = {}) {
  const response = await fetch(pathname, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    redirectToAdmin();
    throw new Error("Session expired.");
  }

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
    const response = await fetch("/api/auth/session", {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      state.sessionUser = null;
      redirectToAdmin();
      return;
    }

    if (!response.ok) {
      state.sessionUser = null;
      return;
    }

    const payload = await response.json();
    state.sessionUser = payload.user || null;
  } catch (error) {
    state.sessionUser = null;
  }
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

async function loadArticlesFromWorker() {
  const payload = await workerJson("/api/articles");
  return sortArticles(Array.isArray(payload.articles) ? payload.articles : []);
}

async function loadDocumentsFromWorker() {
  const payload = await workerJson("/api/documents");
  return sortDocuments(Array.isArray(payload.documents) ? payload.documents : []);
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
              <summary>Attach a webpage URL</summary>
              <div class="editor-details__body">
                <label class="editor-field">
                  <span class="editor-label">Webpage URL</span>
                  <input
                    class="editor-input"
                    type="url"
                    placeholder="https://example.com/source"
                    value="${escapeHtml(formState.webpage_url || "")}"
                    data-new-source-index="${index}"
                    data-new-source-field="webpage_url"
                  />
                </label>
                <div class="editor-actions" style="margin-top: 1rem;">
                  <button class="editor-button-secondary" type="button" data-action="attach-source-url" data-axiom-index="${index}">
                    Attach webpage URL
                  </button>
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
                  <span class="editor-label">Webpage URL (optional if no file)</span>
                  <input class="editor-input" type="url" placeholder="https://example.com/source" value="${escapeHtml(formState.webpage_url || "")}" data-new-source-index="${index}" data-new-source-field="webpage_url" />
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

function renderPostulateBlock(postulate, index) {
  return `
    <section class="editor-block">
      <div class="editor-block__header">
        <h3 class="editor-section-title">Postulate ${index + 1}</h3>
        <button class="editor-button-ghost" type="button" data-action="remove-postulate" data-postulate-index="${index}">
          Remove postulate
        </button>
      </div>
      <label class="editor-field">
        <span class="editor-label">ID</span>
        <input class="editor-input" type="text" value="${escapeHtml(postulate.id || "")}" data-postulate-index="${index}" data-postulate-field="id" />
      </label>
      <label class="editor-field">
        <span class="editor-label">Verified Fact</span>
        <textarea class="editor-textarea" data-postulate-index="${index}" data-postulate-field="fact">${escapeHtml(postulate.fact || "")}</textarea>
      </label>
    </section>
  `;
}

function renderTheoremBlock(entry, index) {
  return `
    <section class="editor-block">
      <div class="editor-block__header">
        <h3 class="editor-section-title">Theorem ${index + 1}</h3>
        <button class="editor-button-ghost" type="button" data-action="remove-theorem" data-theorem-index="${index}">
          Remove theorem
        </button>
      </div>
      <label class="editor-field">
        <span class="editor-label">Theorem ID</span>
        <input class="editor-input" type="text" value="${escapeHtml(entry.id || "")}" data-theorem-index="${index}" data-theorem-field="id" />
      </label>
      <label class="editor-field">
        <span class="editor-label">Deductive Inference</span>
        <textarea class="editor-textarea" data-theorem-index="${index}" data-theorem-field="step">${escapeHtml(entry.step || "")}</textarea>
      </label>
      <label class="editor-field">
        <span class="editor-label">References (optional)</span>
        <input class="editor-input" type="text" value="${escapeHtml(entry.references || "")}" data-theorem-index="${index}" data-theorem-field="references" />
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
        <span class="editor-pill">${proof.postulates.length} postulates</span>
        <span class="editor-pill">${proof.theorems.length} theorems</span>
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
          <h2>Postulates</h2>
          <button class="editor-button-secondary" type="button" data-action="add-postulate">Add postulate</button>
        </div>
        ${proof.postulates.map((postulate, index) => renderPostulateBlock(postulate, index)).join("")}
      </div>

      <div class="editor-section">
        <div class="editor-panel__header">
          <h2>Theorems</h2>
          <button class="editor-button-secondary" type="button" data-action="add-theorem">Add theorem</button>
        </div>
        ${proof.theorems.map((entry, index) => renderTheoremBlock(entry, index)).join("")}
      </div>

      <div class="editor-block">
        <label class="editor-field">
          <span class="editor-label">Q.E.D.</span>
          <textarea class="editor-textarea" data-proof-field="qed">${escapeHtml(proof.qed || "")}</textarea>
        </label>
      </div>
    </section>
  `;
}

function render() {
  persistUiState();
  document.title = "Democratic Justice Proof Desk";

  const detectedLabel = state.sessionUser
    ? `Signed in as ${state.sessionUser.name || state.sessionUser.email || "staff user"}.`
    : "Not signed in to the Proof Desk.";
  const toolbarStatus = !state.selectedArticle
    ? "No article selected"
    : hasUnsavedProofChanges()
      ? "Proof changes not saved"
      : "All changes saved";
  document.title = `${hasUnsavedProofChanges() ? "* " : ""}Democratic Justice Proof Desk`;

  root.innerHTML = `
    <div class="editor-shell">
      <div class="editor-frame editor-app">
        <div class="editor-toolbar">
          <div class="editor-toolbar__nav">
            <a class="editor-button-ghost" href="/admin/">Back to Editorial Desk</a>
            <a class="editor-button-ghost" href="/admin/cms/">Open Content Desk</a>
          </div>
          <div class="editor-toolbar__actions">
            <div class="editor-toolbar__status" data-dirty="${hasUnsavedProofChanges() ? "true" : "false"}" role="status" aria-live="polite">
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
                  <p class="editor-kicker">Publication session</p>
                  <h2>Access</h2>
                </div>
              </div>
              <p>${escapeHtml(detectedLabel)}</p>
              <p class="editor-muted">The Proof Desk runs through the same authenticated admin session used across the newsroom tools.</p>
              <div class="editor-actions" style="margin-top: 1rem;">
                <button class="editor-button-ghost" type="button" data-action="worker-logout">Sign out</button>
              </div>
            </section>

            <section class="editor-panel">
              <div class="editor-panel__header">
                <div>
                  <p class="editor-kicker">Article picker</p>
                  <h2>Articles</h2>
                </div>
                <span class="editor-muted">${state.articles.length} total</span>
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

  const payload = await workerJson(`/api/article?slug=${encodeURIComponent(state.selectedArticle.slug)}`);
  const nextProof = hasMeaningfulValue(payload.article?.proof) ? normalizeProof(payload.article.proof || {}) : normalizeProof({});

  state.selectedArticle = {
    ...state.selectedArticle,
    repo_path: payload.article?.repo_path || state.selectedArticle.repo_path,
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
  syncProofBaseline();
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
  syncProofBaseline();
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

  await loadWorkerSession();

  if (!state.sessionUser) {
    redirectToAdmin();
    return;
  }

  const [articles, documents] = await Promise.all([loadArticlesFromWorker(), loadDocumentsFromWorker()]);
  state.articles = articles;
  state.documents = documents;

  if (!state.selectedSlug && state.articles.length) {
    state.selectedSlug = state.articles[0].slug;
  }

  if (state.selectedSlug) {
    const stillExists = state.articles.some((article) => article.slug === state.selectedSlug);

    if (stillExists) {
      await selectArticle(state.selectedSlug);
    } else if (state.articles.length) {
      state.selectedSlug = state.articles[0].slug;
      await selectArticle(state.selectedSlug);
    } else {
      state.selectedSlug = "";
      state.selectedArticle = null;
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

  if (!state.sessionUser) {
    setStatus("You must be signed in before saving proof changes.", "error");
    return;
  }

  state.saving = true;
  render();

  try {
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
    syncProofBaseline();
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

  if (!state.sessionUser) {
    setStatus("You must be signed in before creating source documents.", "error");
    return;
  }

  const webpageUrl = (formState.webpage_url || "").trim();
  const hasWebpageUrl = Boolean(webpageUrl);

  if (!(formState.title || "").trim() || !(formState.description || "").trim()) {
    setStatus("New source documents need a title and description.", "error");
    return;
  }

  if (!(formState.obtained || "").trim() || !(formState.source_method || "").trim()) {
    setStatus("New source documents need an obtained date and source method.", "error");
    return;
  }

  if (!formState.file && !hasWebpageUrl) {
    setStatus("Add either a source file or a webpage URL.", "error");
    return;
  }

  if (hasWebpageUrl && !isWebUrl(webpageUrl)) {
    setStatus("Enter a valid http(s) webpage URL.", "error");
    return;
  }

  if (hasWebpageUrl) {
    const axiom = state.selectedArticle.proof.axioms[index];
    axiom.sources = dedupeSources([...(axiom.sources || []), { document_url: webpageUrl }]);
    axiom.no_source_needed = false;
    delete state.newSourceForms[index];

    updateValidationPanel();
    setStatus("Attached webpage URL source.", "success");
    return;
  }

  try {
    const file = formState.file;
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const payload = await workerJson("/api/create-document", {
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
  } catch (error) {
    setStatus(`Could not create the source document. ${error.message || error}`, "error");
  }
}

function handleInput(event) {
  const proofField = event.target.dataset.proofField;
  const axiomField = event.target.dataset.axiomField;
  const postulateField = event.target.dataset.postulateField;
  const theoremField = event.target.dataset.theoremField;
  const articleFilter = event.target.dataset.ui;
  const sourceSearch = event.target.dataset.sourceSearch;
  const newSourceField = event.target.dataset.newSourceField;

  if (articleFilter === "article-filter") {
    state.articleFilter = event.target.value;
    render();
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

  if (postulateField) {
    const postulate = state.selectedArticle.proof.postulates[Number(event.target.dataset.postulateIndex)];
    if (postulate) {
      postulate[postulateField] = event.target.value;
      updateValidationPanel();
    }
    return;
  }

  if (theoremField) {
    const entry = state.selectedArticle.proof.theorems[Number(event.target.dataset.theoremIndex)];

    if (entry) {
      entry[theoremField] = event.target.value;
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
    const slug = actionTarget.dataset.slug;

    if (!slug || slug === state.selectedSlug) {
      return;
    }

    if (!confirmDiscardChanges("open another article")) {
      return;
    }

    selectArticle(slug);
    return;
  }

  if (action === "refresh-data") {
    if (!confirmDiscardChanges("reload the desk")) {
      return;
    }

    loadDeskData()
      .then(() => setStatus("Reloaded article and document data.", "success"))
      .catch((error) => setStatus(`Could not reload desk data. ${error.message || error}`, "error"));
    return;
  }

  if (action === "worker-logout") {
    if (!confirmDiscardChanges("sign out")) {
      return;
    }

    workerRequest("/api/auth/logout", {
      method: "POST"
    })
      .then(async () => {
        redirectToAdmin();
      })
      .catch((error) => setStatus(`Could not sign out. ${error.message || error}`, "error"));
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

  if (action === "add-postulate") {
    state.selectedArticle.proof.postulates.push(defaultPostulate());
    render();
    return;
  }

  if (action === "remove-postulate") {
    state.selectedArticle.proof.postulates.splice(Number(actionTarget.dataset.postulateIndex), 1);
    render();
    return;
  }

  if (action === "add-theorem") {
    state.selectedArticle.proof.theorems.push(defaultTheorem());
    render();
    return;
  }

  if (action === "remove-theorem") {
    state.selectedArticle.proof.theorems.splice(Number(actionTarget.dataset.theoremIndex), 1);
    if (!state.selectedArticle.proof.theorems.length) {
      state.selectedArticle.proof.theorems.push(defaultTheorem());
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

  if (action === "attach-source-url") {
    const axiomIndex = Number(actionTarget.dataset.axiomIndex);
    const axiom = state.selectedArticle.proof.axioms[axiomIndex];
    const formState = state.newSourceForms[axiomIndex] || {};
    const webpageUrl = (formState.webpage_url || "").trim();

    if (!axiom) {
      return;
    }

    if (!isWebUrl(webpageUrl)) {
      setStatus("Enter a valid http(s) URL before attaching a webpage source.", "error");
      return;
    }

    axiom.sources = dedupeSources([...(axiom.sources || []), { document_url: webpageUrl }]);
    axiom.no_source_needed = false;
    if (state.newSourceForms[axiomIndex]) {
      delete state.newSourceForms[axiomIndex].webpage_url;
    }
    updateValidationPanel();
    setStatus("Attached webpage source URL.", "success");
    return;
  }

  if (action === "create-source") {
    createSourceForAxiom(Number(actionTarget.dataset.axiomIndex));
  }
}

function handleKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
    if (!state.selectedArticle || state.saving) {
      return;
    }

    event.preventDefault();
    saveProof();
  }
}

function handleBeforeUnload(event) {
  if (!hasUnsavedProofChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

async function init() {
  try {
    restoreUiState();
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
root.addEventListener("keydown", handleKeydown);
window.addEventListener("beforeunload", handleBeforeUnload);

init();
