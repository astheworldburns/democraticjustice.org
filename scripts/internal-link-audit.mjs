import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "_site");
const strict = process.argv.includes("--strict");

const htmlLinkPattern = /(?:href|src)=["']([^"']+)["']/gi;
const ignoredPrefixes = ["http://", "https://", "mailto:", "tel:", "javascript:", "data:", "#"];

async function collectFiles(entryPath, baseDir = entryPath) {
  const entries = await readdir(entryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(entryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(nextPath, baseDir)));
      continue;
    }

    files.push(path.relative(baseDir, nextPath).split(path.sep).join("/"));
  }

  return files;
}

function normalizeTarget(target = "") {
  return target.split("#")[0].split("?")[0].trim();
}

function decodePathname(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function canResolveToFile(absTargetPath) {
  const candidates = [
    absTargetPath,
    `${absTargetPath}.html`,
    path.join(absTargetPath, "index.html")
  ];

  for (const candidate of candidates) {
    try {
      const candidateStat = await stat(candidate);
      if (candidateStat.isFile()) {
        return true;
      }
    } catch {
      // Continue to next candidate.
    }
  }

  return false;
}

function toPublicRootPath(fromFile = "") {
  const absPath = path.join(publicDir, fromFile);
  const relDir = path.dirname(path.relative(publicDir, absPath));
  return relDir === "." ? "/" : `/${relDir}/`;
}

function toAbsolutePublicTarget(rawTarget = "", currentPublicRoute = "/") {
  if (rawTarget.startsWith("/")) {
    return rawTarget;
  }

  return new URL(rawTarget, `https://democraticjustice.org${currentPublicRoute}`).pathname;
}

async function main() {
  const publicFiles = await collectFiles(publicDir);
  const htmlFiles = publicFiles.filter((filePath) => filePath.endsWith(".html"));
  const missingLinks = [];

  for (const filePath of htmlFiles) {
    const absoluteFilePath = path.join(publicDir, filePath);
    const contents = await readFile(absoluteFilePath, "utf8");
    const currentPublicRoute = toPublicRootPath(filePath);

    for (const match of contents.matchAll(htmlLinkPattern)) {
      const rawTarget = (match[1] || "").trim();

      if (!rawTarget || ignoredPrefixes.some((prefix) => rawTarget.startsWith(prefix))) {
        continue;
      }

      const normalizedTarget = normalizeTarget(rawTarget);
      if (!normalizedTarget) {
        continue;
      }

      const absolutePublicTarget = decodePathname(toAbsolutePublicTarget(normalizedTarget, currentPublicRoute));
      const absoluteTargetPath = path.join(publicDir, absolutePublicTarget.replace(/^\//, ""));
      const resolved = await canResolveToFile(absoluteTargetPath);

      if (!resolved) {
        missingLinks.push({ source: filePath, target: rawTarget, resolved: absolutePublicTarget });
      }
    }
  }

  if (missingLinks.length === 0) {
    console.log(`Internal link audit passed: checked ${htmlFiles.length} HTML file(s), found no broken internal links.`);
    return;
  }

  const uniqueMissing = new Map();
  for (const issue of missingLinks) {
    const key = `${issue.source} -> ${issue.target}`;
    if (!uniqueMissing.has(key)) {
      uniqueMissing.set(key, issue);
    }
  }

  console.warn(`Internal link audit found ${uniqueMissing.size} broken internal link(s).`);
  for (const issue of uniqueMissing.values()) {
    console.warn(`- ${issue.source}: \"${issue.target}\" (resolved: ${issue.resolved})`);
  }

  if (strict) {
    process.exitCode = 1;
    return;
  }

  console.warn("Warnings only in default mode. Run `npm run audit:links:strict` to fail on broken links.");
}

await main();
