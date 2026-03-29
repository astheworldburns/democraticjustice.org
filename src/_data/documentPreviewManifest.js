import { readFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = path.join(process.cwd(), "src", "_data", "document-previews.json");

export default async function documentPreviewManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
