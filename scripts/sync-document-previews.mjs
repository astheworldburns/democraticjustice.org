import { writeFile } from "node:fs/promises";
import path from "node:path";

const manifestUrl = process.env.DOCUMENT_PREVIEW_MANIFEST_URL;
const outputPath = path.join(process.cwd(), "src", "_data", "document-previews.json");

if (!manifestUrl) {
  console.error("DOCUMENT_PREVIEW_MANIFEST_URL is required");
  process.exit(1);
}

const response = await fetch(manifestUrl, {
  headers: {
    Accept: "application/json"
  }
});

if (!response.ok) {
  console.error(`Failed to fetch manifest (${response.status})`);
  process.exit(1);
}

const manifest = await response.json();
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Wrote ${outputPath}`);
