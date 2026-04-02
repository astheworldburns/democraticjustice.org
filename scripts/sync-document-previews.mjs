import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const ROOT = process.cwd();
const SOURCE_DIRECTORIES = [
  path.join(ROOT, "static", "documents"),
  path.join(ROOT, "src", "content", "documents", "static", "documents")
];
const GENERATED_DIR = path.join(ROOT, ".generated", "document-previews");
const MANIFEST_PATH = path.join(ROOT, ".generated", "document-previews.json");
const STANDARD_FONT_URL = `${pathToFileURL(path.join(ROOT, "node_modules", "pdfjs-dist", "standard_fonts")).href}/`;
const WASM_URL = `${pathToFileURL(path.join(ROOT, "node_modules", "pdfjs-dist", "wasm")).href}/`;

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 1600;
const RENDER_SCALE = 2;

function isPdf(filename = "") {
  return filename.toLowerCase().endsWith(".pdf");
}

function previewFilenameFor(filename = "") {
  return `${filename.replace(/\.pdf$/i, "")}.preview.webp`;
}

function previewUrlFor(filename = "") {
  return `/assets/document-previews/${previewFilenameFor(filename)}`;
}

function slugFor(filename = "") {
  return path.parse(filename).name;
}

function parseArgs(argv) {
  return {
    force: argv.includes("--force")
  };
}

async function loadPdfJs() {
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = DOMMatrix;
  }

  if (!globalThis.ImageData) {
    globalThis.ImageData = ImageData;
  }

  if (!globalThis.Path2D) {
    globalThis.Path2D = Path2D;
  }

  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function ensureOutputPaths() {
  await mkdir(GENERATED_DIR, { recursive: true });
}

async function clearGeneratedPreviews() {
  await rm(GENERATED_DIR, { recursive: true, force: true });
  await mkdir(GENERATED_DIR, { recursive: true });
}

async function listSourcePdfs() {
  const pdfByFilename = new Map();

  for (const sourceDirectory of SOURCE_DIRECTORIES) {
    let entries = [];

    try {
      entries = await readdir(sourceDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !isPdf(entry.name)) {
        continue;
      }

      const fullPath = path.join(sourceDirectory, entry.name);
      const current = pdfByFilename.get(entry.name);

      if (!current) {
        pdfByFilename.set(entry.name, { filename: entry.name, sourcePath: fullPath });
        continue;
      }

      const [nextStats, currentStats] = await Promise.all([
        stat(fullPath),
        stat(current.sourcePath)
      ]);

      if (nextStats.mtimeMs > currentStats.mtimeMs) {
        pdfByFilename.set(entry.name, { filename: entry.name, sourcePath: fullPath });
      }
    }
  }

  return Array.from(pdfByFilename.values()).sort((left, right) =>
    left.filename.localeCompare(right.filename)
  );
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function renderFirstPageToWebp(pdfRecord, pdfjs) {
  const { filename, sourcePath } = pdfRecord;
  const pdfBytes = new Uint8Array(await readFile(sourcePath));
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    disableWorker: true,
    standardFontDataUrl: STANDARD_FONT_URL,
    wasmUrl: WASM_URL,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    useSystemFonts: true
  });

  const document = await loadingTask.promise;

  try {
    const page = await document.getPage(1);

    try {
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(TARGET_WIDTH / baseViewport.width, TARGET_HEIGHT / baseViewport.height);
      const renderViewport = page.getViewport({ scale: fitScale * RENDER_SCALE });
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(
        Math.ceil(renderViewport.width),
        Math.ceil(renderViewport.height)
      );

      try {
        canvasAndContext.context.fillStyle = "#ffffff";
        canvasAndContext.context.fillRect(0, 0, canvasAndContext.canvas.width, canvasAndContext.canvas.height);

        await page.render({
          canvasContext: canvasAndContext.context,
          viewport: renderViewport,
          canvasFactory
        }).promise;

        const pngBuffer = canvasAndContext.canvas.toBuffer("image/png");
        const previewPath = path.join(GENERATED_DIR, previewFilenameFor(filename));

        await sharp(pngBuffer)
          .resize(TARGET_WIDTH, TARGET_HEIGHT, {
            fit: "contain",
            background: "#ffffff"
          })
          .webp({ quality: 86 })
          .toFile(previewPath);

        return previewPath;
      } finally {
        canvasFactory.destroy(canvasAndContext);
      }
    } finally {
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
}

async function isPreviewCurrent(pdfRecord) {
  const { filename, sourcePath } = pdfRecord;
  const previewPath = path.join(GENERATED_DIR, previewFilenameFor(filename));

  if (!(await fileExists(previewPath))) {
    return false;
  }

  const [pdfStats, previewStats] = await Promise.all([stat(sourcePath), stat(previewPath)]);

  return previewStats.mtimeMs >= pdfStats.mtimeMs;
}

async function writeManifest(pdfRecords) {
  const manifest = {};

  for (const pdfRecord of pdfRecords) {
    const { filename } = pdfRecord;
    const previewFilename = previewFilenameFor(filename);
    const previewPath = path.join(GENERATED_DIR, previewFilename);

    if (!(await fileExists(previewPath))) {
      continue;
    }

    const previewUrl = previewUrlFor(filename);
    manifest[`/documents/${filename}`] = previewUrl;
    manifest[slugFor(filename)] = previewUrl;
  }

  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  await ensureOutputPaths();

  const pdfFiles = await listSourcePdfs();

  if (!pdfFiles.length) {
    await writeManifest([]);
    console.log("No PDF source documents found. Wrote empty generated preview manifest.");
    return;
  }

  const pdfjs = await loadPdfJs();

  if (force) {
    await clearGeneratedPreviews();
  }

  console.log(`Generating previews for ${pdfFiles.length} PDF source document(s)...`);

  for (const pdfRecord of pdfFiles) {
    if (!force && (await isPreviewCurrent(pdfRecord))) {
      console.log(`Preview already current for ${pdfRecord.filename}.`);
      continue;
    }

    console.log(`Rendering ${pdfRecord.filename}...`);
    await renderFirstPageToWebp(pdfRecord, pdfjs);
  }

  const manifest = await writeManifest(pdfFiles);
  console.log(`Wrote ${MANIFEST_PATH}`);
  console.log(`Generated ${Object.keys(manifest).length / 2} preview image(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
