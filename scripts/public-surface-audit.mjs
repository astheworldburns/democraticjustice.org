import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(rootDir, "_site");
const strict = process.argv.includes("--strict");

const allowedAdminFiles = new Set([
  "admin/config.yml",
  "admin/index.html",
  "admin/editorial.css",
  "admin/cms/index.html",
  "admin/cms/init.js",
  "admin/cms/data/config.json",
  "admin/cms/vendor/sveltia-cms-0.150.1.js",
  "admin/editor/index.html",
  "admin/editor/app.js",
  "admin/editor/data/config.json",
  "admin/proof/index.html",
  "admin/proof/app.js",
  "admin/proof/data/config.json"
]);

const docLikeNamePattern = /(guide|manual|workflow|setup|audit|readme|owners?)/i;
const ignoredDotfiles = new Set(["_headers", ".gitkeep"]);

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

  return files.sort((left, right) => left.localeCompare(right));
}

async function main() {
  const publicFiles = await collectFiles(publicDir);
  const unexpectedAdminFiles = publicFiles.filter((filePath) => filePath.startsWith("admin/") && !allowedAdminFiles.has(filePath));
  const docLikeFiles = publicFiles.filter((filePath) => docLikeNamePattern.test(path.basename(filePath)));
  const hiddenFiles = publicFiles.filter((filePath) => {
    const parts = filePath.split("/");
    return parts.some((part, index) => {
      if (!part.startsWith(".")) {
        return false;
      }

      if (ignoredDotfiles.has(part)) {
        return false;
      }

      return index !== 0 || !ignoredDotfiles.has(part);
    });
  });
  const docsRoutes = publicFiles.filter((filePath) => filePath.startsWith("docs/"));

  const issueCount =
    unexpectedAdminFiles.length +
    docLikeFiles.length +
    hiddenFiles.length +
    docsRoutes.length;

  if (issueCount === 0) {
    console.log(`Public surface audit passed: checked ${publicFiles.length} emitted files and found no unexpected public routes.`);
    return;
  }

  console.warn(`Public surface audit found ${issueCount} issue(s) across ${publicFiles.length} emitted files.`);

  if (unexpectedAdminFiles.length) {
    console.warn("\nUnexpected admin-public files:");
    for (const filePath of unexpectedAdminFiles) {
      console.warn(`- ${filePath}`);
    }
  }

  if (docLikeFiles.length) {
    console.warn("\nGuide-like public filenames:");
    for (const filePath of docLikeFiles) {
      console.warn(`- ${filePath}`);
    }
  }

  if (hiddenFiles.length) {
    console.warn("\nHidden files in public output:");
    for (const filePath of hiddenFiles) {
      console.warn(`- ${filePath}`);
    }
  }

  if (docsRoutes.length) {
    console.warn("\nUnexpected docs routes:");
    for (const filePath of docsRoutes) {
      console.warn(`- ${filePath}`);
    }
  }

  console.warn("\nOnly the newsroom runtime should be public under /admin/. Keep guides, setup notes, and operational docs in /docs or another non-published path.");

  if (strict) {
    process.exitCode = 1;
    return;
  }

  console.warn("Warnings only in default mode. Run `npm run audit:public:strict` to fail on these issues.");
}

await main();
