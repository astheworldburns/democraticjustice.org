const DEFAULT_SITE_TITLE = "Democratic Justice";
const PROOF_SYMBOL = "∴";

function normalizeWhitespace(value = "") {
  return (value ?? "")
    .toString()
    .replace(/\s+/g, " ")
    .trim();
}

export function hasMeaningfulValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulValue(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => hasMeaningfulValue(entry));
  }

  return normalizeWhitespace(value).length > 0;
}

function titleCaseFragment(value = "") {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackSourceLabel(sourceUrl = "") {
  const normalized = normalizeWhitespace(sourceUrl);

  if (/^https?:\/\//i.test(normalized)) {
    try {
      return new URL(normalized).hostname.replace(/^www\./, "") || "Web source";
    } catch {
      return "Web source";
    }
  }

  const slug = normalized.replace(/^\/documents\//, "").replace(/\/$/, "");
  return titleCaseFragment(slug) || "Source document";
}

function ensureSourceUrl(value, label, contextLabel) {
  const sourceUrl = ensureString(value, label, contextLabel);

  if (/^\/documents\/[^/]+\/$/.test(sourceUrl) || /^https?:\/\//i.test(sourceUrl)) {
    return sourceUrl;
  }

  throw new Error(
    `${contextLabel} has an invalid source URL "${sourceUrl}". Proof sources must link to /documents/{slug}/ or http(s) URLs.`
  );
}

function findSourceDocument(documentUrl = "", sourceDocuments = null) {
  if (!Array.isArray(sourceDocuments) || !sourceDocuments.length) {
    return null;
  }

  const normalizedUrl = normalizeWhitespace(documentUrl).replace(/\/+$/, "");

  return (
    sourceDocuments.find((item) => (item.url || "").replace(/\/+$/, "") === normalizedUrl) ||
    sourceDocuments.find((item) => `/documents/${item.fileSlug}` === normalizedUrl) ||
    sourceDocuments.find((item) => `/documents/${item.fileSlug}/` === normalizedUrl) ||
    null
  );
}

function normalizeProofSources(entry = {}, index, contextLabel, sourceDocuments = null, collectionName = "axioms") {
  const noSourceNeeded = Boolean(entry?.no_source_needed);
  const rawSources = Array.isArray(entry?.sources) ? entry.sources : [];
  const sources = rawSources.reduce((entries, source, sourceIndex) => {
    const documentSource =
      source && typeof source === "object" && hasMeaningfulValue(source.document_url)
        ? normalizeWhitespace(source.document_url)
        : "";
    const webpageSource =
      source && typeof source === "object" && hasMeaningfulValue(source.webpage_url)
        ? normalizeWhitespace(source.webpage_url)
        : "";

    const sourceUrl = typeof source === "string" ? source : webpageSource || documentSource;

    if (!hasMeaningfulValue(sourceUrl)) {
      return entries;
    }

    const normalizedUrl = ensureSourceUrl(
      sourceUrl,
      `${collectionName}[${index}].sources[${sourceIndex}]`,
      contextLabel
    );

    const isInternalDocument = /^\/documents\//.test(normalizedUrl);

    if (isInternalDocument && sourceDocuments && !findSourceDocument(normalizedUrl, sourceDocuments)) {
      throw new Error(
        `${contextLabel} references a missing source document "${normalizedUrl}". Add the document record or remove the axiom citation.`
      );
    }

    const explicitLabel =
      source && typeof source === "object" && hasMeaningfulValue(source.label)
        ? normalizeWhitespace(source.label)
        : "";

    entries.push({
      index: entries.length + 1,
      documentUrl: normalizedUrl,
      label: explicitLabel || fallbackSourceLabel(normalizedUrl),
      sourceType: isInternalDocument ? "document" : "webpage"
    });

    return entries;
  }, []);

  if (hasMeaningfulValue(entry?.source_url)) {
    const legacyUrl = ensureSourceUrl(entry.source_url, `${collectionName}[${index}].source_url`, contextLabel);
    const legacyLabel = ensureString(entry?.source_label, `${collectionName}[${index}].source_label`, contextLabel);
    if (sourceDocuments && !findSourceDocument(legacyUrl, sourceDocuments)) {
      throw new Error(
        `${contextLabel} references a missing source document "${legacyUrl}". Add the document record or remove the axiom citation.`
      );
    }

    sources.push({
      index: sources.length + 1,
      documentUrl: legacyUrl,
      label: legacyLabel || fallbackSourceLabel(legacyUrl),
      sourceType: /^\/documents\//.test(legacyUrl) ? "document" : "webpage"
    });
  }

  if (noSourceNeeded && sources.length > 0) {
    throw new Error(
      `${contextLabel} cannot mark ${collectionName.slice(0, -1)} ${index + 1} as requiring no source while also linking source documents.`
    );
  }

  if (!noSourceNeeded && sources.length === 0) {
    throw new Error(
      `${contextLabel} must link at least one source document or explicitly mark ${collectionName.slice(0, -1)} ${index + 1} as needing no source.`
    );
  }

  return {
    noSourceNeeded,
    sources
  };
}

function ensureString(value, label, contextLabel) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error(`${contextLabel} is missing required proof field "${label}".`);
  }

  return normalized;
}

function ensureArray(value, label, contextLabel) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${contextLabel} must include at least one "${label}" entry.`);
  }

  return value;
}

export function truncateProofText(value = "", maxLength = 180) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxLength + 1);
  const withoutTrailingWord = sliced.replace(/\s+\S*$/, "").trim();

  return `${withoutTrailingWord || normalized.slice(0, maxLength).trim()}…`;
}

export function createProofCard(data = {}) {
  const rawProof = data.proof;

  if (!rawProof || typeof rawProof !== "object" || !hasMeaningfulValue(rawProof)) {
    return null;
  }

  const slug = normalizeWhitespace(data.page?.fileSlug || data.fileSlug);
  const articleTitle = ensureString(data.title, "title", "Proof-backed article");

  if (!slug) {
    throw new Error(`Proof-backed article "${articleTitle}" is missing a file slug.`);
  }

  const articleUrl = normalizeWhitespace(data.page?.url || data.url || `/${slug}/`);
  const contextLabel = `Proof-backed article "${articleTitle}"`;
  const issue = ensureString(rawProof.issue, "issue", contextLabel);
  const qed = ensureString(rawProof.qed || rawProof.conclusion, "qed", contextLabel);

  const axioms = ensureArray(rawProof.axioms, "axiom", contextLabel).map((axiom, index) => {
    const premise = ensureString(axiom?.premise, `axioms[${index}].premise`, contextLabel);
    const id = hasMeaningfulValue(axiom?.id) ? normalizeWhitespace(axiom.id) : `A${index + 1}`;
    const { noSourceNeeded, sources } = normalizeProofSources(
      axiom,
      index,
      contextLabel,
      data.sourceDocuments,
      "axioms"
    );

    return {
      index: index + 1,
      id,
      premise,
      noSourceNeeded,
      sources
    };
  });

  const rawPostulates = Array.isArray(rawProof.postulates) ? rawProof.postulates : [];
  const postulates = rawPostulates
    .filter((postulate) => hasMeaningfulValue(postulate))
    .map((postulate, index) => {
      const fact = ensureString(postulate?.fact || postulate?.premise, `postulates[${index}].fact`, contextLabel);
      const id = hasMeaningfulValue(postulate?.id) ? normalizeWhitespace(postulate.id) : `P${index + 1}`;
      const { noSourceNeeded, sources } = normalizeProofSources(
        postulate,
        index,
        contextLabel,
        data.sourceDocuments,
        "postulates"
      );

      return {
        index: index + 1,
        id,
        fact,
        noSourceNeeded,
        sources
      };
    });

  const theoremSource = Array.isArray(rawProof.theorems) && rawProof.theorems.length ? rawProof.theorems : rawProof.logic;
  const theorems = ensureArray(theoremSource, "theorem", contextLabel).map((entry, index) => ({
    index: index + 1,
    id: hasMeaningfulValue(entry?.id) ? normalizeWhitespace(entry.id) : `T${index + 1}`,
    step: ensureString(entry?.step, `theorems[${index}].step`, contextLabel),
    references: hasMeaningfulValue(entry?.references) ? normalizeWhitespace(entry.references) : ""
  }));

  const siteTitle = normalizeWhitespace(data.siteTitle) || DEFAULT_SITE_TITLE;
  const shareImagePath = `/assets/images/proof-cards/${slug}.png`;
  const socialDescription = truncateProofText(`${issue} ${PROOF_SYMBOL} ${qed}`, 220);
  const sourceDocumentMap = new Map();

  for (const sourceItem of [...axioms, ...postulates]) {
    for (const source of sourceItem.sources) {
      if (!sourceDocumentMap.has(source.documentUrl)) {
        sourceDocumentMap.set(source.documentUrl, {
          documentUrl: source.documentUrl,
          label: source.label,
          sourceType: source.sourceType || (/^\/documents\//.test(source.documentUrl) ? "document" : "webpage")
        });
      }
    }
  }

  const sourceDocuments = Array.from(sourceDocumentMap.values());

  return {
    slug,
    articleTitle,
    articleDescription: normalizeWhitespace(data.description),
    articleUrl,
    siteTitle,
    issue,
    axioms,
    postulates,
    theorems,
    qed,
    conclusion: qed,
    logic: theorems,
    conclusionMarked: `${PROOF_SYMBOL} ${qed}`,
    shareImagePath,
    issueShort: truncateProofText(issue, 165),
    conclusionShort: truncateProofText(qed, 280),
    socialDescription,
    axiomCount: axioms.length,
    postulateCount: postulates.length,
    theoremCount: theorems.length,
    logicCount: theorems.length,
    sourceDocuments,
    sourceDocumentCount: sourceDocuments.length
  };
}

export function isProofBacked(data = {}) {
  return Boolean(createProofCard(data));
}
