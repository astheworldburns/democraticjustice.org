import { execFile } from "node:child_process";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

import Image from "@11ty/eleventy-img";
import pluginRss from "@11ty/eleventy-plugin-rss";
import { DateTime } from "luxon";

const execFileAsync = promisify(execFile);

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

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss, {
    posthtmlRenderOptions: {
      closingSingleTag: "default"
    }
  });

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");

  eleventyConfig.addWatchTarget("./tailwind.config.js");
  eleventyConfig.addWatchTarget("./src/assets/css/tailwind.css");

  eleventyConfig.addCollection("article", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./src/content/articles/**/*.md")
      .sort((left, right) => left.date - right.date)
  );

  eleventyConfig.addCollection("authorProfiles", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("./src/content/authors/**/*.md")
      .sort((left, right) => left.data.name.localeCompare(right.data.name))
  );

  eleventyConfig.addCollection("editorialTagList", (collectionApi) => {
    const tags = new Set();

    for (const item of collectionApi.getFilteredByGlob("./src/content/articles/**/*.md")) {
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

  eleventyConfig.addCollection("articleArchive", (collectionApi) => {
    const posts = collectionApi
      .getFilteredByGlob("./src/content/articles/**/*.md")
      .sort((left, right) => right.date - left.date);
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

  eleventyConfig.addFilter("displayDate", (value) => {
    const parsed = toDateTime(value);
    return parsed.isValid ? parsed.toFormat("MMMM d, yyyy") : "";
  });

  eleventyConfig.addFilter("displayYear", (value) => {
    const parsed = toDateTime(value);
    return parsed.isValid ? parsed.toFormat("yyyy") : "";
  });

  eleventyConfig.addFilter("slugifyTag", slugifyTag);
  eleventyConfig.addFilter("tagLabel", tagLabel);
  eleventyConfig.addFilter("initials", initials);
  eleventyConfig.addFilter("getAuthor", getAuthorProfile);

  eleventyConfig.addGlobalData("buildDate", new Date());

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
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>{{ site.name }}</title>
    <link>{{ site.url }}</link>
    <atom:link href="{{ "/feed.xml" | absoluteUrl(site.url) }}" rel="self" type="application/rss+xml" />
    <description>{{ site.description }}</description>
    <language>en-US</language>
    {%- for post in collections.article | reverse %}
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

    await execFileAsync("npx", ["pagefind", "--site", directories.output]);
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    },
    templateFormats: ["md", "njk"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
}
