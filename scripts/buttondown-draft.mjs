import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FEED_PATH = path.join(ROOT, "_site", "feed.xml");
const ARTICLE_SOURCE_DIR = path.join(ROOT, "src", "content", "articles");
const ENV_FILES = [".env.local", ".env"];
const BUTTONDOWN_API_URL = "https://api.buttondown.com/v1/emails";
const STRONG_LINK_STYLE = "color: #111111 !important; text-decoration: underline !important; -webkit-text-fill-color: #111111;";
const articleSourceCache = new Map();

function parseArgs(argv = []) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    check: argv.includes("--check")
  };
}

function loadLocalEnv() {
  for (const file of ENV_FILES) {
    const filePath = path.join(ROOT, file);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function decodeXmlEntities(value = "") {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPublishDate(value = "") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function extractTag(source, tagName) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
  const match = source.match(pattern);
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function readFeedItems() {
  if (!fs.existsSync(FEED_PATH)) {
    throw new Error("Missing _site/feed.xml. Run `npm run build` first.");
  }

  const feedXml = fs.readFileSync(FEED_PATH, "utf8");
  const itemMatches = [...feedXml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  if (!itemMatches.length) {
    throw new Error("No public article found in _site/feed.xml.");
  }

  const items = itemMatches
    .map((match) => match[1])
    .map((itemXml) => ({
      title: extractTag(itemXml, "title"),
      link: extractTag(itemXml, "link"),
      description: extractTag(itemXml, "description"),
      author: extractTag(itemXml, "author"),
      pubDate: extractTag(itemXml, "pubDate"),
      content: extractTag(itemXml, "content:encoded")
    }))
    .filter((item) => item.title && item.link);

  if (!items.length) {
    throw new Error("Feed items are missing required title/link fields.");
  }

  return items;
}

function stripHtmlTags(value = "") {
  return value.replace(/<[^>]+>/g, " ");
}

function readFeedExcerpt(contentHtml = "") {
  if (!contentHtml) {
    return [];
  }

  const paragraphs = [...contentHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtmlTags(match[1] || ""))
    .map((text) => cleanMarkdownBlock(decodeXmlEntities(text)))
    .filter(Boolean)
    .filter((text) => text.length > 40);

  if (!paragraphs.length) {
    return [];
  }

  const excerptCount = Math.min(6, Math.max(2, Math.ceil(paragraphs.length / 3)));
  return paragraphs.slice(0, excerptCount);
}

function buildSubject(article) {
  return article.title;
}

function getArticleSlug(articleLink) {
  const url = new URL(articleLink);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
}

function extractFrontmatterBlock(markdown = "") {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  return match ? match[1] : "";
}

function normalizeFrontmatterValue(value = "") {
  const trimmed = value.trim();

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function extractFrontmatterValue(frontmatter = "", key = "") {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedKey}:\\s*(.+)$`, "m");
  const match = frontmatter.match(pattern);
  return match ? normalizeFrontmatterValue(match[1]) : "";
}

function resolveArticleSource(articleLink) {
  const slug = getArticleSlug(articleLink);

  if (!slug) {
    return null;
  }

  if (articleSourceCache.has(slug)) {
    return articleSourceCache.get(slug);
  }

  const directPath = path.join(ARTICLE_SOURCE_DIR, `${slug}.md`);
  let sourcePath = fs.existsSync(directPath) ? directPath : null;
  let markdown = sourcePath ? fs.readFileSync(sourcePath, "utf8") : "";

  if (!sourcePath) {
    const entries = fs.readdirSync(ARTICLE_SOURCE_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const candidatePath = path.join(ARTICLE_SOURCE_DIR, entry.name);
      const candidateMarkdown = fs.readFileSync(candidatePath, "utf8");
      const frontmatter = extractFrontmatterBlock(candidateMarkdown);

      if (extractFrontmatterValue(frontmatter, "url_slug") !== slug) {
        continue;
      }

      sourcePath = candidatePath;
      markdown = candidateMarkdown;
      break;
    }
  }

  if (!sourcePath) {
    articleSourceCache.set(slug, null);
    return null;
  }

  const frontmatter = extractFrontmatterBlock(markdown);
  const resolved = {
    sourcePath,
    markdown,
    title: extractFrontmatterValue(frontmatter, "title"),
    description: extractFrontmatterValue(frontmatter, "description"),
    date: extractFrontmatterValue(frontmatter, "date"),
    urlSlug: extractFrontmatterValue(frontmatter, "url_slug") || slug
  };

  articleSourceCache.set(slug, resolved);
  return resolved;
}

function applySourceOverrides(article = {}) {
  const source = resolveArticleSource(article.link);

  if (!source) {
    return article;
  }

  return {
    ...article,
    title: source.title || article.title,
    description: source.description || article.description,
    pubDate: source.date || article.pubDate
  };
}

function stripFrontmatter(markdown = "") {
  return markdown.replace(/^---[\s\S]*?---\s*/, "");
}

function cleanMarkdownBlock(block = "") {
  return block
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[*_`#]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNarrativeBlock(block = "") {
  const trimmed = block.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("![")) {
    return false;
  }

  if (trimmed.startsWith("<")) {
    return false;
  }

  if (trimmed.startsWith("#")) {
    return false;
  }

  if (/^\*{0,2}Author'?s note:/i.test(trimmed)) {
    return false;
  }

  if (/^_.*_$/.test(trimmed)) {
    return false;
  }

  return true;
}

function readArticleExcerpt(articleLink) {
  const source = resolveArticleSource(articleLink);

  if (!source) {
    return [];
  }

  const body = stripFrontmatter(source.markdown);
  const rawBlocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const narrativeBlocks = rawBlocks
    .filter(isNarrativeBlock)
    .map(cleanMarkdownBlock)
    .filter(Boolean);

  if (!narrativeBlocks.length) {
    return [];
  }

  const excerptCount = Math.min(6, Math.max(2, Math.ceil(narrativeBlocks.length / 3)));
  return narrativeBlocks.slice(0, excerptCount);
}

function buildBody(article) {
  const excerptParagraphs = readArticleExcerpt(article.link);
  const fallbackFeedExcerpt = readFeedExcerpt(article.content);
  const selectedExcerpt = excerptParagraphs.length ? excerptParagraphs : fallbackFeedExcerpt;
  const excerptMarkup = selectedExcerpt
    .map((paragraph) => `<p style="margin: 0 0 16px 0;">${escapeHtml(paragraph)}</p>`)
    .join("\n");
  const leadHtml = excerptMarkup || '<p style="margin: 0 0 16px 0;">Read today\'s story at Democratic Justice.</p>';

  return [
    '<div style="font-family: Georgia, \'Times New Roman\', serif; font-size: 20px; line-height: 1.65; color: #111;">',
    leadHtml,
    `  <p style="margin: 24px 0 0 0;"><a href="${escapeHtml(article.link)}" style="${STRONG_LINK_STYLE} font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700;">Continue reading</a></p>`,
    '  <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #444;">Every Democratic Justice story opens with a proof card and the source documents behind it.</p>',
    '  <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #111111;">',
    `    <a href="{{ unsubscribe_url }}" style="${STRONG_LINK_STYLE} font-weight: 700;">Unsubscribe</a>`,
    '    {% if manage_subscription_url %}',
    '      <span style="color: #444444;"> or </span><a href="{{ manage_subscription_url }}" style="' + STRONG_LINK_STYLE + ' font-weight: 700;">manage your subscription</a>',
    "    {% endif %}",
    "  </p>",
    "</div>"
  ].join("\n");
}

async function fetchDrafts(headers) {
  const params = new URLSearchParams({
    status: "draft",
    ordering: "-creation_date"
  });

  const response = await fetch(`${BUTTONDOWN_API_URL}?${params.toString()}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`Could not check existing Buttondown drafts (${response.status}).`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function findMatchingDraft(drafts = [], article = {}) {
  return drafts.find((draft) => {
    const metadataUrl = draft?.metadata?.article_url;
    const canonicalUrl = draft?.canonical_url;
    return metadataUrl === article.link || canonicalUrl === article.link;
  }) || null;
}

function buildDraftPayload(article, subject, body) {
  const payload = {
    subject,
    body,
    canonical_url: article.link,
    metadata: {
      article_url: article.link,
      article_title: article.title,
      generated_by: "democraticjustice_newsletter_draft"
    }
  };

  if (article.description) {
    payload.description = article.description;
  }

  return payload;
}

async function createDraft(headers, article, subject, body) {
  const response = await fetch(BUTTONDOWN_API_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...buildDraftPayload(article, subject, body),
      subject,
      status: "draft",
      email_type: "public",
      template: "classic"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Buttondown draft creation failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function updateDraft(headers, draftId, article, subject, body) {
  const response = await fetch(`${BUTTONDOWN_API_URL}/${draftId}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildDraftPayload(article, subject, body))
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Buttondown draft update failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

function printDraftSummary(prefix, article, subject, body, draftId = null) {
  console.log(`${prefix}`);
  console.log(`Subject: ${subject}`);
  console.log(`Article: ${article.link}`);

  if (draftId) {
    console.log(`Draft ID: ${draftId}`);
  }

  console.log("");
  console.log("Body preview:");
  console.log(body);
  console.log("");
  console.log("Next:");
  console.log("1. Open Buttondown > Emails");
  console.log("2. Review the draft");
  console.log("3. Send a preview to yourself");
  console.log("4. Schedule it for the time you want");
}

function printConnectivitySummary(feedItems = [], drafts = []) {
  const latestArticle = feedItems[0] ? applySourceOverrides(feedItems[0]) : null;
  console.log("Buttondown connectivity check");
  console.log(`Feed items found: ${feedItems.length}`);
  console.log(`Drafts fetched: ${drafts.length}`);

  if (!latestArticle) {
    console.log("No article found in _site/feed.xml.");
    return;
  }

  const existingDraft = findMatchingDraft(drafts, latestArticle);
  console.log(`Latest feed article: ${latestArticle.title}`);
  console.log(`Latest feed URL: ${latestArticle.link}`);
  console.log(`Matching Buttondown draft: ${existingDraft ? `yes (ID ${existingDraft.id})` : "no"}`);

  const sampleDrafts = drafts.slice(0, 5);

  if (!sampleDrafts.length) {
    console.log("No drafts returned by Buttondown for this API key.");
    return;
  }

  console.log("Recent drafts:");
  for (const draft of sampleDrafts) {
    console.log(`- #${draft.id} ${draft.subject || "(no subject)"} [${draft.status || "unknown"}]`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadLocalEnv();

  const feedItems = readFeedItems().map((item) => applySourceOverrides(item));

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const headers = apiKey
    ? {
      Authorization: `Token ${apiKey}`
    }
    : null;

  if (!apiKey && !options.dryRun) {
    throw new Error("Missing BUTTONDOWN_API_KEY. Set it in your shell or in .env.local.");
  }

  const drafts = options.force || !headers ? [] : await fetchDrafts(headers);

  if (options.check) {
    printConnectivitySummary(feedItems, drafts);
    return;
  }

  const pendingArticle = feedItems[0] || null;

  if (!pendingArticle) {
    throw new Error("No article found in _site/feed.xml.");
  }

  const subject = buildSubject(pendingArticle);
  const body = buildBody(pendingArticle);
  const existingDraft = options.force ? null : findMatchingDraft(drafts, pendingArticle);

  if (options.dryRun) {
    printDraftSummary("Dry run only. No Buttondown draft was created.", pendingArticle, subject, body);
    return;
  }

  if (!headers) {
    throw new Error("Missing BUTTONDOWN_API_KEY. Set it in your shell or in .env.local.");
  }

  if (existingDraft) {
    const draft = await updateDraft(headers, existingDraft.id, pendingArticle, subject, body);
    printDraftSummary("Updated existing Buttondown draft.", pendingArticle, subject, body, draft.id);
    return;
  }

  const draft = await createDraft(headers, pendingArticle, subject, body);
  printDraftSummary("Created Buttondown draft.", pendingArticle, subject, body, draft.id);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
