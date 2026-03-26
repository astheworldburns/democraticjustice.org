import { execFile } from "node:child_process";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";

import Image from "@11ty/eleventy-img";
import pluginRss from "@11ty/eleventy-plugin-rss";
import { DateTime } from "luxon";

import { createProofCard, hasMeaningfulValue } from "./lib/proof.js";
import { renderProofShareImage } from "./lib/proof-share.js";

const execFileAsync = promisify(execFile);
const SITE_TIMEZONE = "America/New_York";
const PROJECT_ROOT = process.cwd();

async function loadSiteSettings(projectRoot = PROJECT_ROOT) {
  try {
    const siteSettingsPath = path.join(projectRoot, "src/_data/siteSettings.json");
    const raw = await readFile(siteSettingsPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function toDateTime(value) {
  if (DateTime.isDateTime(value)) {
    return value;
  }

  if (value instanceof Date) {
    return DateTime.fromJSDate(value);
  }

  if (typeof value === "string") {
    return DateTime.fromISO(value);
  }

  return DateTime.fromJSDate(new Date(value));
}

function resolveImageSource(src) {
  if (!src) {
    return src;
  }

  if (/^https?:\/\//.test(src)) {
    return src;
  }

  if (src.startsWith("/")) {
    return `./src${src}`;
  }

  return src;
}

function slugifyTag(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tagLabel(value = "") {
  return value
    .toString()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(value = "") {
  return value
    .toString()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function stripHtml(value = "") {
  return value
    .toString()
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptText(value = "", length = 430) {
  const plainText = stripHtml(value);

  if (plainText.length <= length) {
    return plainText;
  }

  return `${plainText.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

function machineDate(value) {
  const parsed = toDateTime(value).setZone(SITE_TIMEZONE);
  return parsed.isValid ? parsed.toISO() : "";
}

function readingMinutes(value = "") {
  const words = stripHtml(value).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function injectHeadingIds(value = "") {
  const counts = new Map();

  return value.toString().replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attributes, inner) => {
    if (/\sid=("|')/.test(attributes)) {
      return match;
    }

    const text = stripHtml(inner);
    const baseSlug = slugifyTag(text);

    if (!baseSlug) {
      return match;
    }

    const currentCount = counts.get(baseSlug) || 0;
    counts.set(baseSlug, currentCount + 1);

    const slug = currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount + 1}`;
    return `<h${level}${attributes} id="${slug}">${inner}</h${level}>`;
  });
}

function extractHeadings(value = "") {
  const headings = [];
  const html = injectHeadingIds(value);

  html.replace(/<h([23])([^>]*)id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi, (match, level, attributes, id, inner) => {
    headings.push({
      level: Number(level),
      id,
      text: stripHtml(inner)
    });

    return match;
  });

  return headings;
}

function authorArticles(articles = [], authorKey = "") {
  if (!authorKey) {
    return [];
  }

  return articles
    .filter((article) => article.data.author === authorKey)
    .sort((left, right) => right.date - left.date);
}

function uniqueEditorialTags(articles = [], limit = 0) {
  const tags = new Set();

  for (const article of articles) {
    const articleTags = Array.isArray(article.data.tags)
      ? article.data.tags
      : article.data.tags
        ? [article.data.tags]
        : [];

    for (const tag of articleTags) {
      if (tag && tag !== "article") {
        tags.add(tag);
      }
    }
  }

  const values = Array.from(tags);
  return limit > 0 ? values.slice(0, limit) : values;
}

function findRelatedArticles(articles = [], currentPage = {}, currentTags = [], limit = 3) {
  const tags = (Array.isArray(currentTags) ? currentTags : [currentTags]).filter((tag) => tag && tag !== "article");

  return articles
    .filter((article) => article.url !== currentPage.url)
    .map((article) => {
      const articleTags = Array.isArray(article.data.tags)
        ? article.data.tags
        : article.data.tags
          ? [article.data.tags]
          : [];
      const overlap = articleTags.filter((tag) => tags.includes(tag)).length;

      return {
        article,
        overlap
      };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || right.article.date - left.article.date)
    .slice(0, limit)
    .map(({ article }) => article);
}

function getAuthorProfile(authorKey, authorProfiles = []) {
  if (!authorKey) {
    return null;
  }

  return (
    authorProfiles.find((profile) => profile.data.slug === authorKey) ||
    authorProfiles.find((profile) => profile.fileSlug === authorKey) ||
    null
  );
}

function getSourceDocument(documentUrl, sourceDocuments = []) {
  if (!documentUrl) {
    return null;
  }

  const normalizedUrl = documentUrl.replace(/\/+$/, "");

  return (
    sourceDocuments.find((item) => (item.url || "").replace(/\/+$/, "") === normalizedUrl) ||
    sourceDocuments.find((item) => `/documents/${item.fileSlug}` === normalizedUrl) ||
    null
  );
}

function wrapImageCaptions(value = "") {
  return value.replace(
    /<p>\s*(<img\b[^>]*>)\s*<\/p>\s*<p>\s*<em>([\s\S]*?)<\/em>\s*<\/p>/gi,
    (match, imageHtml, captionHtml) => `<figure>${imageHtml}<figcaption>${captionHtml.trim()}</figcaption></figure>`
  );
}

function sortByDateDesc(items = []) {
  return [...items].sort((left, right) => right.date - left.date);
}

function proofCardForItem(item = {}) {
  if (!hasMeaningfulValue(item.data?.proof)) {
    return null;
  }

  return createProofCard({
    ...item.data,
    title: item.data?.title,
    description: item.data?.description,
    proof: item.data?.proof,
    fileSlug: item.fileSlug,
    url: item.url
  });
}

function publishedArticles(items = []) {
  const now = DateTime.now().setZone(SITE_TIMEZONE);

  return items.filter((item) => {
    const publicationDate = toDateTime(item.date).setZone(SITE_TIMEZONE);
    return publicationDate.isValid && publicationDate <= now && Boolean(proofCardForItem(item));
  });
}

export default async function (eleventyConfig) {
  const proofShareManifest = [];

  eleventyConfig.addPlugin(pluginRss, {
    posthtmlRenderOptions: {
      closingSingleTag: "default"
    }
  });

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/assets/images/uploads");
  eleventyConfig.addPassthroughCopy({ "static/documents": "documents" });
  eleventyConfig.addPassthroughCopy("src/admin");

  eleventyConfig.addWatchTarget("./tailwind.config.js");
  eleventyConfig.addWatchTarget("./src/assets/css/tailwind.css");

  eleventyConfig.addTransform("imageCaptions", (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith(".html")) {
      return content;
    }

    return wrapImageCaptions(content);
  });

  eleventyConfig.addCollection("article", (collectionApi) =>
    publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    )
  );

  eleventyConfig.addCollection("publishedArticle", (collectionApi) =>
    publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    )
  );

  eleventyConfig.addCollection("articleFile", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./src/content/articles/**/*.md")
      .sort((left, right) => right.date - left.date)
  );

  eleventyConfig.addCollection("proofArticle", (collectionApi) => {
    const items = publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    );

    proofShareManifest.length = 0;

    return items.reduce((entries, article) => {
      const proofCard = createProofCard({
        ...article.data,
        title: article.data.title,
        description: article.data.description,
        proof: article.data.proof,
        fileSlug: article.fileSlug,
        url: article.url
      });

      if (!proofCard) {
        return entries;
      }

      proofShareManifest.push(proofCard);
      entries.push({
        article,
        proofCard
      });

      return entries;
    }, []);
  });

  eleventyConfig.addCollection("sourceDocument", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./src/content/documents/**/*.md")
      .sort((left, right) => left.data.title.localeCompare(right.data.title))
  );

  eleventyConfig.addCollection("authorProfiles", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./src/content/authors/**/*.md")
      .sort((left, right) => left.data.name.localeCompare(right.data.name))
  );

  eleventyConfig.addCollection("editorialTagList", (collectionApi) => {
    const tags = new Set();

    for (const item of publishedArticles(collectionApi.getFilteredByGlob("./src/content/articles/**/*.md"))) {
      const itemTags = Array.isArray(item.data.tags)
        ? item.data.tags
        : item.data.tags
          ? [item.data.tags]
          : [];

      for (const tag of itemTags) {
        if (tag && tag !== "article") {
          tags.add(tag);
        }
      }
    }

    return Array.from(tags).sort((left, right) => left.localeCompare(right));
  });

  eleventyConfig.addCollection("editorialDesks", (collectionApi) => {
    const posts = publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    );
    const desks = new Set();

    for (const post of posts) {
      const postTags = Array.isArray(post.data.tags)
        ? post.data.tags
        : post.data.tags
          ? [post.data.tags]
          : [];

      for (const tag of postTags) {
        if (tag && tag !== "article") {
          desks.add(tag);
        }
      }
    }

    return Array.from(desks)
      .map((tag) => {
        const items = posts.filter((post) => {
          const postTags = Array.isArray(post.data.tags)
            ? post.data.tags
            : post.data.tags
              ? [post.data.tags]
              : [];

          return postTags.includes(tag);
        });

        return {
          tag,
          slug: slugifyTag(tag),
          label: tagLabel(tag),
          count: items.length,
          latest: items[0] || null
        };
      })
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  });

  eleventyConfig.addCollection("articleArchive", (collectionApi) => {
    const posts = publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    );
    const buckets = new Map();

    for (const post of posts) {
      const publicationDate = toDateTime(post.date).setZone("America/New_York");
      const key = publicationDate.toFormat("yyyy-MM");

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          label: publicationDate.toFormat("MMMM yyyy"),
          year: publicationDate.toFormat("yyyy"),
          posts: []
        });
      }

      buckets.get(key).posts.push(post);
    }

    return Array.from(buckets.values());
  });

  eleventyConfig.addCollection("articleArchiveYears", (collectionApi) => {
    const posts = publishedArticles(
      collectionApi
        .getFilteredByGlob("./src/content/articles/**/*.md")
        .sort((left, right) => right.date - left.date)
    );
    const yearBuckets = new Map();

    for (const post of posts) {
      const publicationDate = toDateTime(post.date).setZone("America/New_York");
      const monthKey = publicationDate.toFormat("yyyy-MM");
      const yearKey = publicationDate.toFormat("yyyy");

      if (!yearBuckets.has(yearKey)) {
        yearBuckets.set(yearKey, {
          year: yearKey,
          label: yearKey,
          months: new Map()
        });
      }

      const yearBucket = yearBuckets.get(yearKey);

      if (!yearBucket.months.has(monthKey)) {
        yearBucket.months.set(monthKey, {
          key: monthKey,
          label: publicationDate.toFormat("MMMM yyyy"),
          year: yearKey,
          posts: []
        });
      }

      yearBucket.months.get(monthKey).posts.push(post);
    }

    return Array.from(yearBuckets.values())
      .map((bucket) => ({
        year: bucket.year,
        label: bucket.label,
        months: Array.from(bucket.months.values())
      }))
      .sort((left, right) => Number(right.year) - Number(left.year));
  });

  eleventyConfig.addFilter("displayDate", (value) => {
    const parsed = toDateTime(value).setZone(SITE_TIMEZONE);
    return parsed.isValid ? parsed.toFormat("MMMM d, yyyy") : "";
  });

  eleventyConfig.addFilter("displayYear", (value) => {
    const parsed = toDateTime(value).setZone(SITE_TIMEZONE);
    return parsed.isValid ? parsed.toFormat("yyyy") : "";
  });

  eleventyConfig.addFilter("machineDate", machineDate);
  eleventyConfig.addFilter("slugifyTag", slugifyTag);
  eleventyConfig.addFilter("tagLabel", tagLabel);
  eleventyConfig.addFilter("initials", initials);
  eleventyConfig.addFilter("getAuthor", getAuthorProfile);
  eleventyConfig.addFilter("getSourceDocument", getSourceDocument);
  eleventyConfig.addFilter("excerptText", excerptText);
  eleventyConfig.addFilter("readingMinutes", readingMinutes);
  eleventyConfig.addFilter("withHeadingIds", injectHeadingIds);
  eleventyConfig.addFilter("extractHeadings", extractHeadings);
  eleventyConfig.addFilter("articlesByAuthor", authorArticles);
  eleventyConfig.addFilter("uniqueEditorialTags", uniqueEditorialTags);
  eleventyConfig.addFilter("relatedArticles", findRelatedArticles);
  eleventyConfig.addFilter("sortByDateDesc", sortByDateDesc);
  eleventyConfig.addFilter("publishedArticles", publishedArticles);

  eleventyConfig.addGlobalData("buildDate", new Date());
  eleventyConfig.addGlobalData("buildVersion", Date.now().toString());

  eleventyConfig.addNunjucksAsyncShortcode(
    "image",
    async (src, alt = "", sizes = "100vw", className = "") => {
      if (!src) {
        return "";
      }

      const metadata = await Image(resolveImageSource(src), {
        widths: [480, 800, 1280],
        formats: ["avif", "webp", "jpeg"],
        outputDir: "./_site/assets/images/optimized",
        urlPath: "/assets/images/optimized/"
      });

      return Image.generateHTML(metadata, {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
        class: className
      });
    }
  );

  eleventyConfig.addTemplate(
    "feed.njk",
    `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="/assets/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{{ site.name }}</title>
    <link>{{ site.url }}</link>
    <atom:link href="{{ "/feed.xml" | absoluteUrl(site.url) }}" rel="self" type="application/rss+xml" />
    <description>{{ site.description }}</description>
    <language>en-US</language>
    {%- for post in collections.article %}
    {%- set absolutePostUrl = post.url | absoluteUrl(site.url) %}
    {%- set postAuthor = post.data.author | getAuthor(collections.authorProfiles) %}
    <item>
      <title>{{ post.data.title }}</title>
      <link>{{ absolutePostUrl }}</link>
      <guid>{{ absolutePostUrl }}</guid>
      <description>{{ post.data.description | escape }}</description>
      <author>{{ postAuthor.data.name if postAuthor else site.author }}</author>
      <content:encoded>{{ post.templateContent | htmlToAbsoluteUrls(site.url) }}</content:encoded>
      <pubDate>{{ post.date | dateToRfc822 }}</pubDate>
    </item>
    {%- endfor %}
  </channel>
</rss>`,
    {
      permalink: "feed.xml",
      eleventyExcludeFromCollections: true
    }
  );

  eleventyConfig.on("eleventy.after", async ({ directories }) => {
    const cssOutputDir = path.resolve(directories.output, "assets/css");
    const cssOutputPath = path.join(cssOutputDir, "style.css");
    const proofOutputDir = path.resolve(directories.output, "assets/images/proof-cards");
    const siteSettings = await loadSiteSettings(PROJECT_ROOT);

    await mkdir(cssOutputDir, { recursive: true });

    await execFileAsync("npx", [
      "tailwindcss",
      "-c",
      "./tailwind.config.js",
      "-i",
      "./src/assets/css/tailwind.css",
      "-o",
      cssOutputPath,
      "--minify"
    ]);

    await Promise.all(
      proofShareManifest.map((proofCard) =>
        renderProofShareImage(proofCard, proofOutputDir, {
          projectRoot: PROJECT_ROOT,
          siteTitle: siteSettings.site_title
        })
      )
    );

    await execFileAsync("npx", ["pagefind", "--site", directories.output]);
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    },
    templateFormats: ["md", "njk", "11ty.js"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
}
