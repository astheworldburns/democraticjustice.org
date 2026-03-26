import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FEED_PATH = path.join(ROOT, "_site", "feed.xml");
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

function buildBody(article) {
  const lines = [
    "<!-- buttondown-editor-mode: plaintext -->",
    `# ${article.title}`,
    "",
    article.description,
    "",
    `[Read the record](${article.link})`
  ];

  if (article.author || article.pubDate) {
    lines.push("");
    lines.push(`_${[article.author, article.pubDate].filter(Boolean).join(" · ")}_`);
  }

  return lines.filter((line) => line !== undefined).join("\n");
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
