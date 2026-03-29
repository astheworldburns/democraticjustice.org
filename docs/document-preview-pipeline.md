# Document Preview Pipeline

This site now generates PDF thumbnails during the normal Eleventy build.

## Desired workflow

1. Upload a PDF in the CMS as a source document.
2. Publish the entry so the CMS commits the Markdown file and PDF into GitHub.
3. Cloudflare Pages pulls `main` and runs `npm run build`.
4. The build generates a first-page WebP preview automatically.
5. The finished document page, document cards, and social metadata use that preview.

There is no separate preview command in the publishing workflow.

## How the backend build works

- PDFs live in `static/documents/`.
- `npm run build` now runs `npm run preview:sync` before Eleventy.
- `scripts/sync-document-previews.mjs` renders page 1 from each PDF using `pdfjs-dist` plus `@napi-rs/canvas`.
- The script writes generated previews to `.generated/document-previews/`.
- The script writes the build-time manifest to `.generated/document-previews.json`.
- Eleventy copies `.generated/document-previews/` into the public `/assets/document-previews/` output.
- `src/_data/documentPreviewManifest.js` reads the generated manifest during the build.

## Files involved

- `static/documents/*.pdf`
- `scripts/sync-document-previews.mjs`
- `.generated/document-previews/*.preview.webp`
- `.generated/document-previews.json`
- `src/_data/documentPreviewManifest.js`
- `eleventy.config.js`

## What you need to do

For normal publishing:

1. Create or edit the source document in `/admin/`.
2. Upload the PDF.
3. Publish.
4. Wait for the Cloudflare Pages deploy to finish.
5. Open the document page and confirm the preview image appears.

For setup:

1. Keep Cloudflare Pages build command set to `npm run build`.
2. Keep Node version set to `22.16.0`.
3. Make sure the updated `package-lock.json` is committed so Pages installs the PDF rendering dependencies.

## If a preview does not appear

1. Open the Cloudflare Pages build logs.
2. Look for the `preview:sync` step before Eleventy starts.
3. Check whether the uploaded file in `static/documents/` is really a PDF.
4. Confirm the source document frontmatter points `file:` at `/documents/your-file.pdf`.

## Notes

- The older Worker/R2 preview path can remain as an optional experiment, but it is no longer required for the CMS publishing workflow.
- Generated preview artifacts live under `.generated/` and are ignored by Git.
