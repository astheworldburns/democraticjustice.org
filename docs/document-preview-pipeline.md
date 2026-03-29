# Document preview pipeline (R2 + Worker + Eleventy)

This project can render PDF thumbnails to WebP and feed them back into Eleventy so document cards and social previews use a real document image.

## What this adds

1. **Upload PDF to R2** (`democraticjustice-documents`).
2. **Queue job** (`document-preview-jobs`) with the R2 object key.
3. **Worker consumer** (`workers/document-preview-pipeline`) renders page 1 to WebP using Cloudflare Browser Rendering.
4. Worker stores `<original-name>.preview.webp` in R2 and updates original PDF **custom metadata** with:
   - `preview_image`
   - `preview_generated_at`
5. A manifest endpoint (JSON) maps PDF paths/slugs to preview image URLs.
6. `scripts/sync-document-previews.mjs` pulls this JSON before Eleventy build and writes `src/_data/document-previews.json`.
7. Eleventy uses this to populate `preview_image` automatically for document cards and OG/Twitter metadata.

## Worker deployment

```bash
cd workers/document-preview-pipeline
npm install
npm run deploy
```

Bindings are declared in `wrangler.toml`:

- `DOCS_BUCKET` (R2)
- `PREVIEW_QUEUE` (Queue producer)
- Queue consumer for `document-preview-jobs`
- `BROWSER` (Cloudflare Browser Rendering)

## Manual enqueue endpoint

`POST /` body:

```json
{ "keys": ["wvyd-january-2026-amended-f4.pdf"] }
```

This is useful as a fallback if you do not yet have automatic R2 event notifications wired.

## Eleventy integration

The site now checks previews in this order:

1. Front matter `preview_image`
2. If the file itself is an image, use `file`
3. `src/_data/document-previews.json` mapping by file path or slug

That computed `preview_image` is also used for `socialImage` on document pages.
