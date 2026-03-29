import { readFile } from "node:fs/promises";
import path from "node:path";

const GENERATED_MANIFEST_PATH = path.join(process.cwd(), ".generated", "document-previews.json");
const FALLBACK_MANIFEST_PATH = path.join(process.cwd(), "src", "_data", "document-previews.json");

export default async function documentPreviewManifest() {
  for (const manifestPath of [GENERATED_MANIFEST_PATH, FALLBACK_MANIFEST_PATH]) {
    try {
      const raw = await readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return {};
}
