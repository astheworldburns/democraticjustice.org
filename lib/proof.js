const DEFAULT_SITE_TITLE = "Democratic Justice";
const PROOF_SYMBOL = "∴";

function normalizeWhitespace(value = "") {
  return value
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

function fallbackDocumentLabel(documentUrl = "") {
  const slug = normalizeWhitespace(documentUrl)
    .replace(/^\/documents\//, "")
    .replace(/\/$/, "");

  return titleCaseFragment(slug) || "Source document";
}

function ensureDocumentUrl(value, label, contextLabel) {
  const documentUrl = ensureString(value, label, contextLabel);

  if (!/^\/documents\/[^/]+\/$/.test(documentUrl)) {
    throw new Error(
      `${contextLabel} has an invalid source URL "${documentUrl}". Proof sources must link to /documents/{slug}/.`
    );
  }

  return documentUrl;
}

function normalizeAxiomSources(axiom = {}, index, contextLabel) {
  const noSourceNeeded = Boolean(axiom?.no_source_needed);
  const rawSources = Array.isArray(axiom?.sources) ? axiom.sources : [];
  const sources = rawSources.reduce((entries, source, sourceIndex) => {
    const documentUrl =
      typeof source === "string"
        ? source
        : source && typeof source === "object"
          ? source.document_url
          : "";

    if (!hasMeaningfulValue(documentUrl)) {
      return entries;
    }

    const normalizedUrl = ensureDocumentUrl(
      documentUrl,
      `axioms[${index}].sources[${sourceIndex}].document_url`,
      contextLabel
    );
    const explicitLabel =
      source && typeof source === "object" && hasMeaningfulValue(source.label)
        ? normalizeWhitespace(source.label)
        : "";

    entries.push({
      index: entries.length + 1,
      documentUrl: normalizedUrl,
      label: explicitLabel || fallbackDocumentLabel(normalizedUrl)
    });

    return entries;
  }, []);

  if (hasMeaningfulValue(axiom?.source_url)) {
    const legacyUrl = ensureDocumentUrl(axiom.source_url, `axioms[${index}].source_url`, contextLabel);
    const legacyLabel = ensureString(axiom?.source_label, `axioms[${index}].source_label`, contextLabel);

    sources.push({
      index: sources.length + 1,
      documentUrl: legacyUrl,
      label: legacyLabel
    });
  }

  if (noSourceNeeded && sources.length > 0) {
    throw new Error(
      `${contextLabel} cannot mark axiom ${index + 1} as requiring no source while also linking source documents.`
    );
  }

  if (!noSourceNeeded && sources.length === 0) {
    throw new Error(
      `${contextLabel} must link at least one source document or explicitly mark axiom ${index + 1} as needing no source.`
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

  const articleUrl = normalizeWhitespace(data.page?.url || data.url || `/articles/${slug}/`);
  const contextLabel = `Proof-backed article "${articleTitle}"`;
  const issue = ensureString(rawProof.issue, "issue", contextLabel);
  const conclusion = ensureString(rawProof.conclusion, "conclusion", contextLabel);
  const inference = hasMeaningfulValue(rawProof.inference)
    ? normalizeWhitespace(rawProof.inference)
    : "";

  const axioms = ensureArray(rawProof.axioms, "axiom", contextLabel).map((axiom, index) => {
    const premise = ensureString(axiom?.premise, `axioms[${index}].premise`, contextLabel);
    const { noSourceNeeded, sources } = normalizeAxiomSources(axiom, index, contextLabel);

    return {
      index: index + 1,
      premise,
      noSourceNeeded,
      sources
    };
  });

  const logic = ensureArray(rawProof.logic, "logic", contextLabel).map((entry, index) => ({
    index: index + 1,
    step: ensureString(entry?.step, `logic[${index}].step`, contextLabel)
  }));

  const siteTitle = normalizeWhitespace(data.siteTitle) || DEFAULT_SITE_TITLE;
  const shareImagePath = `/assets/images/proof-cards/${slug}.png`;
  const socialDescription = truncateProofText(`${issue} ${PROOF_SYMBOL} ${conclusion}`, 220);
  const sourceDocumentMap = new Map();

  for (const axiom of axioms) {
    for (const source of axiom.sources) {
      if (!sourceDocumentMap.has(source.documentUrl)) {
        sourceDocumentMap.set(source.documentUrl, {
          documentUrl: source.documentUrl,
          label: source.label
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
    logic,
    inference,
    conclusion,
    conclusionMarked: `${PROOF_SYMBOL} ${conclusion}`,
    shareImagePath,
    issueShort: truncateProofText(issue, 165),
    conclusionShort: truncateProofText(conclusion, 280),
    socialDescription,
    axiomCount: axioms.length,
    logicCount: logic.length,
    sourceDocuments,
    sourceDocumentCount: sourceDocuments.length
  };
}

export function isProofBacked(data = {}) {
  return Boolean(createProofCard(data));
}
