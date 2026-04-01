import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FEED_PATH = path.join(ROOT, "_site", "feed.xml");
const ARTICLE_SOURCE_DIR = path.join(ROOT, "src", "content", "articles");
const ENV_FILES = [".env.local", ".env"];
const BUTTONDOWN_API_URL = "https://api.buttondown.com/v1/emails";

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
      pubDate: extractTag(itemXml, "pubDate")
    }))
    .filter((item) => item.title && item.link);

  if (!items.length) {
    throw new Error("Feed items are missing required title/link fields.");
  }

  return items;
}

function buildSubject(article) {
  return article.title;
}

function getArticleSlug(articleLink) {
  const url = new URL(articleLink);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.at(-1) || "";
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
  const slug = getArticleSlug(articleLink);

  if (!slug) {
    return [];
  }

  const sourcePath = path.join(ARTICLE_SOURCE_DIR, `${slug}.md`);

  if (!fs.existsSync(sourcePath)) {
    return [];
  }

  const markdown = fs.readFileSync(sourcePath, "utf8");
  const body = stripFrontmatter(markdown);
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

  const excerptCount = Math.max(1, Math.ceil(narrativeBlocks.length / 3));
  return narrativeBlocks.slice(0, excerptCount);
}

function buildBody(article) {
  const excerptParagraphs = readArticleExcerpt(article.link);
  const excerptHtml = excerptParagraphs
    .map((paragraph) => `<p style="margin: 0 0 16px 0;">${escapeHtml(paragraph)}</p>`)
    .join("\n");
  const leadHtml = excerptHtml || `<p style="margin: 0 0 16px 0;">${escapeHtml(article.description || "")}</p>`;

  return [
    '<div style="font-family: Georgia, \'Times New Roman\', serif; font-size: 20px; line-height: 1.65; color: #111;">',
    leadHtml,
    `  <p style="margin: 24px 0 0 0;"><a href="${escapeHtml(article.link)}" style="color: #111; text-decoration: underline; font-family: Arial, Helvetica, sans-serif; font-size: 16px;">Continue reading</a></p>`,
    '  <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #444;">Every Democratic Justice story opens with a proof card and the source documents behind it.</p>',
    '  <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111;">',
    '    <a href="{{ unsubscribe_url }}" style="color: #111; text-decoration: underline; font-weight: 700;">Unsubscribe</a>',
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

async function createDraft(headers, article, subject, body) {
  const response = await fetch(BUTTONDOWN_API_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject,
      body,
      status: "draft",
      email_type: "public",
      template: "classic",
      description: article.description,
      canonical_url: article.link,
      metadata: {
        article_url: article.link,
        article_title: article.title,
        generated_by: "democraticjustice_newsletter_draft"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Buttondown draft creation failed (${response.status}): ${errorText}`);
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
  const latestArticle = feedItems[0] || null;
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

  const feedItems = readFeedItems();

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
  const pendingArticle = options.force
    ? feedItems[0]
    : feedItems.find((item) => !findMatchingDraft(drafts, item));

  if (!pendingArticle) {
    throw new Error("Every article currently in _site/feed.xml already has a matching Buttondown draft.");
  }

  const subject = buildSubject(pendingArticle);
  const body = buildBody(pendingArticle);

  if (options.dryRun) {
    printDraftSummary("Dry run only. No Buttondown draft was created.", pendingArticle, subject, body);
    return;
  }

  if (!options.force) {
    const existingDraft = findMatchingDraft(drafts, pendingArticle);

    if (existingDraft) {
      printDraftSummary("A matching Buttondown draft already exists. No new draft was created.", pendingArticle, subject, body, existingDraft.id);
      return;
    }
  }

  if (!headers) {
    throw new Error("Missing BUTTONDOWN_API_KEY. Set it in your shell or in .env.local.");
  }

  const draft = await createDraft(headers, pendingArticle, subject, body);
  printDraftSummary("Created Buttondown draft.", pendingArticle, subject, body, draft.id);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
