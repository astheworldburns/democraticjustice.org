import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadsDir = path.join(rootDir, "src/assets/images/uploads");
const searchEntries = [path.join(rootDir, "src"), path.join(rootDir, "static"), path.join(rootDir, "eleventy.config.js")];
const skippedPaths = [
  uploadsDir,
  path.join(rootDir, "src/admin/cms/vendor"),
  path.join(rootDir, "_site"),
  path.join(rootDir, "node_modules"),
  path.join(rootDir, ".git")
];
const textExtensions = new Set([".11ty.js", ".cjs", ".css", ".html", ".js", ".json", ".md", ".mjs", ".njk", ".toml", ".txt", ".yaml", ".yml"]);
const largeAssetThresholdBytes = 500 * 1024;
const strict = process.argv.includes("--strict");

function formatBytes(bytes = 0) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSkippedPath(filePath) {
  return skippedPaths.some((entry) => filePath === entry || filePath.startsWith(`${entry}${path.sep}`));
}

function isTextFile(filePath) {
  const basename = path.basename(filePath).toLowerCase();

  if (basename.endsWith(".11ty.js")) {
    return true;
  }

  return textExtensions.has(path.extname(basename));
}

async function collectTextFiles(entryPath) {
  if (isSkippedPath(entryPath)) {
    return [];
  }

  const entryStat = await stat(entryPath);

  if (entryStat.isDirectory()) {
    const files = [];
    const entries = await readdir(entryPath, { withFileTypes: true });

    for (const entry of entries) {
      files.push(...(await collectTextFiles(path.join(entryPath, entry.name))));
    }

    return files;
  }

  return isTextFile(entryPath) ? [entryPath] : [];
}

async function loadReferenceCorpus() {
  const textFiles = [];

  for (const entry of searchEntries) {
    textFiles.push(...(await collectTextFiles(entry)));
  }

  const contents = await Promise.all(
    textFiles.map(async (filePath) => {
      const buffer = await readFile(filePath);
      return buffer.includes(0) ? "" : buffer.toString("utf8");
    })
  );

  return contents.join("\n");
}

function referencePatterns(fileName) {
  const publicPath = `/assets/images/uploads/${fileName}`;
  const encodedPublicPath = encodeURI(publicPath);

  return [publicPath, encodedPublicPath, publicPath.slice(1), encodedPublicPath.slice(1)];
}

function isReferenced(fileName, corpus) {
  return referencePatterns(fileName).some((pattern) => corpus.includes(pattern));
}

function expectedKind(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "jpeg";
  }

  if (extension === ".png") {
    return "png";
  }

  if (extension === ".gif") {
    return "gif";
  }

  if (extension === ".svg") {
    return "svg";
  }

  if (extension === ".webp") {
    return "webp";
  }

  if (extension === ".avif") {
    return "avif";
  }

  return null;
}

function detectedKind(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (buffer.length >= 6) {
    const gifHeader = buffer.toString("ascii", 0, 6);

    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return "gif";
    }
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);

    if (brand === "avif" || brand === "avis") {
      return "avif";
    }

    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "heif";
    }
  }

  const header = buffer.toString("utf8", 0, 256).trimStart();

  if (header.startsWith("<svg") || (header.startsWith("<?xml") && header.includes("<svg"))) {
    return "svg";
  }

  return null;
}

async function main() {
  const uploadEntries = await readdir(uploadsDir, { withFileTypes: true });
  const uploadFiles = uploadEntries
    .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const corpus = await loadReferenceCorpus();
  const unreferenced = [];
  const namingIssues = [];
  const formatIssues = [];
  const largeAssets = [];

  for (const fileName of uploadFiles) {
    const filePath = path.join(uploadsDir, fileName);
    const fileBuffer = await readFile(filePath);
    const fileStats = await stat(filePath);

    if (!isReferenced(fileName, corpus)) {
      unreferenced.push(fileName);
    }

    if (/\s/.test(fileName) || /[A-Z]/.test(fileName)) {
      namingIssues.push(fileName);
    }

    const expected = expectedKind(fileName);
    const detected = detectedKind(fileBuffer);

    if (expected && detected && expected !== detected) {
      formatIssues.push({ fileName, expected, detected });
    }

    if (fileStats.size > largeAssetThresholdBytes) {
      largeAssets.push({ fileName, size: fileStats.size });
    }
  }

  const issueCount = unreferenced.length + namingIssues.length + formatIssues.length + largeAssets.length;

  if (issueCount === 0) {
    console.log(`Asset audit passed: checked ${uploadFiles.length} public uploads and found no issues.`);
    return;
  }

  console.warn(`Asset audit found ${issueCount} issue(s) across ${uploadFiles.length} public uploads.`);

  if (unreferenced.length) {
    console.warn("\nUnreferenced uploads:");
    for (const fileName of unreferenced) {
      console.warn(`- ${fileName}`);
    }
  }

  if (namingIssues.length) {
    console.warn("\nNaming issues:");
    for (const fileName of namingIssues) {
      console.warn(`- ${fileName} (prefer lowercase, hyphenated filenames without spaces)`);
    }
  }

  if (formatIssues.length) {
    console.warn("\nFormat mismatches:");
    for (const issue of formatIssues) {
      console.warn(`- ${issue.fileName} (extension suggests ${issue.expected}, file bytes look like ${issue.detected})`);
    }
  }

  if (largeAssets.length) {
    console.warn("\nLarge public uploads:");
    for (const asset of largeAssets.sort((left, right) => right.size - left.size)) {
      console.warn(`- ${asset.fileName} (${formatBytes(asset.size)})`);
    }
  }

  console.warn("\nLarge editorial figures should live in src/assets/images/source and render through the {% image %} shortcode so only optimized derivatives ship.");

  if (strict) {
    process.exitCode = 1;
    return;
  }

  console.warn("Warnings only in default mode. Run `npm run audit:assets:strict` to fail on these issues.");
}

await main();
