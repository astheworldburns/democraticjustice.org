import { decodeHTMLAttribute } from "entities";

const DEFAULT_SITE_URL = "https://democraticjustice.org";
const anchorPattern = /<a\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
const attributePattern = /\s+([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function documentPath(value, baseUrl, siteUrl) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim(), baseUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname !== siteUrl.hostname || url.port !== siteUrl.port) {
      return null;
    }
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    return pathname.startsWith("/documents/") ? pathname : null;
  } catch {
    return null;
  }
}

function bodyLinks(html) {
  if (typeof html !== "string") return [];
  const content = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const links = [];

  for (const [anchor] of content.matchAll(anchorPattern)) {
    for (const attribute of anchor.matchAll(attributePattern)) {
      if (attribute[1].toLowerCase() === "href") {
        links.push(decodeHTMLAttribute(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""));
        break;
      }
    }
  }
  return links;
}

/** Return only cited records; pass rendered body explicitly so Eleventy can track its dependency. */
export function leadSourceDocuments(article, documents = [], bodyHtml = "", siteUrl = DEFAULT_SITE_URL) {
  if (!article || !Array.isArray(documents)) return [];

  let site;
  let articleUrl;
  try {
    site = new URL(article.data?.site?.url || siteUrl);
    articleUrl = new URL(article.url || "/", site);
  } catch {
    return [];
  }

  const records = new Map();
  for (const record of documents) {
    const key = documentPath(record.url, site, site);
    if (key && !records.has(key)) records.set(key, record);
  }

  const proofSources = article.data?.proofCard?.sourceDocuments;
  const links = [
    ...(Array.isArray(proofSources) ? proofSources.map((source) => source.documentUrl) : []),
    ...bodyLinks(bodyHtml)
  ];
  const cited = new Map();
  for (const link of links) {
    const key = documentPath(link, articleUrl, site);
    if (key && records.has(key) && !cited.has(key)) cited.set(key, records.get(key));
  }
  return [...cited.values()];
}
