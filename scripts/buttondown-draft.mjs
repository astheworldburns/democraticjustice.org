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
    force: argv.includes("--force")
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

function readLatestFeedItem() {
  if (!fs.existsSync(FEED_PATH)) {
    throw new Error("Missing _site/feed.xml. Run `npm run build` first.");
  }

  const feedXml = fs.readFileSync(FEED_PATH, "utf8");
  const itemMatch = feedXml.match(/<item>([\s\S]*?)<\/item>/i);

  if (!itemMatch) {
    throw new Error("No public article found in _site/feed.xml.");
  }

  const itemXml = itemMatch[1];
  const title = extractTag(itemXml, "title");
  const link = extractTag(itemXml, "link");
  const description = extractTag(itemXml, "description");
  const author = extractTag(itemXml, "author");
  const pubDate = extractTag(itemXml, "pubDate");

  if (!title || !link) {
    throw new Error("Feed item is missing required title or link.");
  }

  return {
    title,
    link,
    description,
    author,
    pubDate
  };
}

function buildSubject(article) {
  return `${article.title} | Democratic Justice`;
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
  const meta = [article.author, formatPublishDate(article.pubDate)].filter(Boolean).join(" · ");
  const excerptHtml = excerptParagraphs
    .map((paragraph) => `<p style="margin: 0 0 18px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; line-height: 1.75; color: #171717;">${escapeHtml(paragraph)}</p>`)
    .join("\n");

  return [
    "<!-- buttondown-editor-mode: fancy -->",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">',
    "  <tr>",
    '    <td style="padding: 0;">',
    '      <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase; color: #5f6368;">Democratic Justice</p>',
    `      <h1 style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 46px; line-height: 1.05; font-weight: 700; color: #111111;">${escapeHtml(article.title)}</h1>`,
    `      <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 24px; line-height: 1.45; color: #4b4f56;">${escapeHtml(article.description)}</p>`,
    `      <p style="margin: 0 0 30px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">${escapeHtml(meta)}</p>`,
    excerptHtml,
    '      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 34px 0 0 0; border-collapse: collapse;">',
    "        <tr>",
    '          <td bgcolor="#111111" style="background-color: #111111;">',
    `            <a href="${escapeHtml(article.link)}" style="display: inline-block; padding: 15px 22px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #ffffff; text-decoration: none;">Continue reading</a>`,
    "          </td>",
    "        </tr>",
    "      </table>",
    '      <p style="margin: 28px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #4b5563;">Every Democratic Justice story opens with a Proof Card and the source documents behind it.</p>',
    '      <p style="margin: 18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.7; color: #111111;">',
    '        <a href="{{ unsubscribe_url }}" style="color: #111111; text-decoration: underline; font-weight: 700;">Unsubscribe</a>',
    '        {% if manage_subscription_url %}',
    '          <span style="color: #6b7280;"> · </span><a href="{{ manage_subscription_url }}" style="color: #111111; text-decoration: underline; font-weight: 700;">Manage subscription</a>',
    "        {% endif %}",
    "      </p>",
    "    </td>",
  "  </tr>",
    "</table>"
  ].join("\n");
}

async function fetchExistingDraft(headers, article, subject) {
  const params = new URLSearchParams({
    status: "draft",
    subject,
    ordering: "-creation_date"
  });

  const response = await fetch(`${BUTTONDOWN_API_URL}?${params.toString()}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`Could not check existing Buttondown drafts (${response.status}).`);
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.find((draft) => {
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadLocalEnv();

  const article = readLatestFeedItem();
  const subject = buildSubject(article);
  const body = buildBody(article);

  if (options.dryRun) {
    printDraftSummary("Dry run only. No Buttondown draft was created.", article, subject, body);
    return;
  }

  const apiKey = process.env.BUTTONDOWN_API_KEY;

  if (!apiKey) {
    throw new Error("Missing BUTTONDOWN_API_KEY. Set it in your shell or in .env.local.");
  }

  const headers = {
    Authorization: `Token ${apiKey}`
  };

  if (!options.force) {
    const existingDraft = await fetchExistingDraft(headers, article, subject);

    if (existingDraft) {
      printDraftSummary("A matching Buttondown draft already exists. No new draft was created.", article, subject, body, existingDraft.id);
      return;
    }
  }

  const draft = await createDraft(headers, article, subject, body);
  printDraftSummary("Created Buttondown draft.", article, subject, body, draft.id);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
