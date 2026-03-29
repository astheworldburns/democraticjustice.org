# Document Architecture Redesign Plan

## Scope and constraints

- This is a **read-only architecture analysis** turned into a plan document.
- No source behavior was changed in this pass.
- Goal: distinguish **primary source documents** from **article illustration images** with the smallest possible implementation delta while preserving current proof-card workflows.

---

## Section 1 — Current flow mapping (as implemented now)

## FLOW A — Adding a new source document

### 1) Where the editor goes

There are currently three practical entry points:

1. **CMS collections UI** (`source_documents` collection in both admin configs):
   - `src/admin/config.yml`
   - `src/admin/cms/config.yml`
2. **Proof Desk / Writer Desk “Create a new source document”** in app UIs (`/api/proof/create-document` and `/api/editor/create-document`).
3. **Manual file creation in Git** (directly adding `.md` in `src/content/documents/` + matching asset in `static/documents/`).

### 2) What they fill out

In CMS `source_documents`, fields are:

- `title` (string)
- `file` (file widget; accepts `application/pdf,.pdf,image/*`)
- `description` (text)
- `obtained` (date)
- `source_method` (string)

In Proof/Writer Desk create-document forms, required fields are the same logical set:

- title
- description
- obtained
- source_method
- file upload (`file_name`, `mime_type`, base64 file bytes posted to worker)

### 3) Where the file is stored

- **CMS source_documents collection** overrides storage to:
  - `media_folder: static/documents`
  - `public_folder: /documents`
- Worker create-document endpoints write binary directly to:
  - `static/documents/{slug}.{ext}` (via `DOCUMENT_ASSET_PATH`, default `static/documents/`)

### 4) Where metadata `.md` gets created

- CMS collection is configured to write markdown entries to:
  - `src/content/documents`
- Worker create-document endpoints write frontmatter files to:
  - `src/content/documents/{slug}.md` (via `DOCUMENT_CONTENT_PATH`, default `src/content/documents/`)

### 5) What collection it joins

- All `src/content/documents/**/*.md` join Eleventy collection `sourceDocument`.
- Sorting is alphabetic by title.

### 6) Where it becomes visible

A created document becomes visible in:

- `/documents/` archive page (`collections.sourceDocument` loop)
- Homepage Evidence Room (`collections.sourceDocument` loop)
- Proof citation lookups and validation (proof pipeline resolves URLs against source documents)
- Proof/Card editor relation dropdown (`collection: source_documents`, value `/documents/{{slug}}/`)

---

## FLOW B — Citing a document in an axiom

Current implementation matches your sequence:

1. Editor opens article in CMS/editor.
2. Goes to `proof -> axioms -> sources`.
3. Relation widget searches `source_documents` collection.
4. Selected value is stored as `/documents/{slug}/` (`value_field: "/documents/{{slug}}/"`).
5. `createProofCard()` validates citation URL format and existence in source document records; missing records throw validation errors.
6. `proof-card.njk` renders axiom citation links as `[1]` etc and links to the document URL.

---

## FLOW C — Adding an image to an article body

### 1) Where editor adds images

- Article body is a markdown widget (`articles -> body -> widget: markdown`), so body images can be inserted there.

### 2) Where article-body images are stored

- Global CMS default media settings are:
  - `media_folder: src/assets/images/uploads`
  - `public_folder: /assets/images/uploads`
- So normal article image embeds go to `/assets/images/uploads/...` unless a collection overrides media settings.

### 3) Do article images auto-create document records?

- **No automatic bridge exists** from article body image uploads to `src/content/documents/*.md`.
- Document records are created only when someone:
  - explicitly creates a `source_documents` entry in CMS, or
  - explicitly uses “Create a new source document” in Proof/Writer Desk (worker endpoint), or
  - manually adds files in Git.

So if JPG/PNG document records exist in `src/content/documents/`, they were intentionally created as source document entries (or manually committed), not auto-generated from body image insertion.

### Flow C file-path check requested (`the-takeover-of-the-west-virginia-young-democrats.md`)

You asked whether the three document files (`.jpg`, `.png`, `.pdf`) appear as **image references in markdown body content**.

Findings:

- The article frontmatter proof cites all three as `document_url` entries:
  - `/documents/wvyd-january-2025-amended-f4/`
  - `/documents/wvyd-january-2026-amended-f4/`
  - `/documents/wvyd-contact-channel-comparison/`
- In body content:
  - There is an image shortcode using `/assets/images/source/wvyd-amended-f4.png` (not `/documents/...`).
  - There is an `<img>` tag using `/assets/images/uploads/wvyd-email.jpg` (not `/documents/...`).
  - There is **no direct `/documents/wvyd-...pdf` image embed in body markdown**.

---

## Section 2 — Minimal fix determination

## A) Are the JPG/PNG document records being cited in axioms?

**Yes.** In the WVYD article proof axioms, all current document URLs are:

1. `/documents/wvyd-january-2025-amended-f4/` (**PNG-backed record**)
2. `/documents/wvyd-january-2026-amended-f4/` (**PDF-backed record**)
3. `/documents/wvyd-contact-channel-comparison/` (**JPG-backed record**)

So both image-backed records are currently cited in proof axioms.

## B/C) Delete vs classify?

Given those citations, immediate deletion of JPG/PNG records would break proof validation/rendering unless article proof data is rewritten first. Therefore:

- **Do not delete now** as a minimal, safe first step.
- Use **classification + filtered views** first.

## D) Absolute minimum change for Evidence Room correctness

The smallest viable approach:

1. Add a classification frontmatter field on source documents (recommended: `primary_source: true|false`).
2. Set `primary_source: true` only for genuine primary sources (official filings, court/government records).
3. Filter homepage Evidence Room to show only `collections.sourceDocument` entries where `primary_source == true`.

This leaves proof citations untouched, preserves relation dropdown behavior, and immediately removes illustration/exhibit records from Evidence Room display.

### Recommendation on model shape

- Short-term minimum: `primary_source` boolean.
- Slightly richer but still small: `document_type: source|exhibit` (future-proof for analytics/UI labels).

For your stated minimum-goal, boolean is enough.

---

## Section 3 — Thumbnail strategy

## Pragmatic choice

Because document additions are infrequent, **Option A (manual thumbnail field)** is most pragmatic.

Why:

- No build pipeline complexity.
- No new heavy dependency (PDF rasterization stack) required.
- Editors can control crop/clarity for page-1 previews.
- Works for scanned or awkward PDFs where auto-generated first pages may look poor.

## Option B feasibility note (pdfjs-dist)

Root repo currently has no `pdfjs-dist` and no canvas/render toolchain. Implementing pure-node PDF rendering robustly often needs additional setup/testing, which is likely overkill for low upload volume.

## Option C (worker-side generation)

Most complex operationally (compute, storage, upload flow, worker image generation details). Not justified for low-frequency document ingest.

## package.json dependency inventory

### Root `package.json`

#### dependencies

- `@fontsource/ibm-plex-mono` ^5.2.7
- `@fontsource/source-serif-4` ^5.2.9
- `@fontsource/space-grotesk` ^5.2.10
- `@resvg/resvg-js` ^2.6.2
- `satori` ^0.26.0
- `satori-html` ^0.3.2

#### devDependencies

- `@11ty/eleventy` ^3.1.2
- `@11ty/eleventy-img` ^5.0.0
- `@11ty/eleventy-plugin-rss` ^2.0.2
- `@tailwindcss/typography` ^0.5.16
- `luxon` ^3.7.2
- `pagefind` ^1.4.0
- `tailwindcss` ^3.4.17

### Worker `workers/proof-desk-gateway/package.json`

#### dependencies

- `js-yaml` ^4.1.0

#### devDependencies

- `wrangler` ^4.10.0

---

## Section 4 — Proposed changes list (dependency order)

Below is the minimal-change plan to achieve correct separation while keeping existing proof links intact.

## 1) Document frontmatter schema changes

**Files:**
- `src/content/documents/*.md` (schema convention)
- `src/admin/config.yml`
- `src/admin/cms/config.yml`

**Change:**
- Add `primary_source` boolean field to document schema (default true for new docs).
- Optional (if adopting thumbnails now): add `thumbnail` image/file field.

**Dependency impact:**
- Non-breaking if templates use safe fallback (`if doc.data.primary_source`).

## 2) Existing document `.md` migrations

**Files:**
- `src/content/documents/wvyd-january-2026-amended-f4.md` -> `primary_source: true`
- `src/content/documents/wvyd-january-2025-amended-f4.md` -> likely `primary_source: false` (if treated as exhibit image)
- `src/content/documents/wvyd-contact-channel-comparison.md` -> `primary_source: false`

**Change:**
- Backfill classification on all existing docs.

**Dependency impact:**
- If template filter assumes explicit boolean, migration should land before/with template filter.

## 3) CMS config updates (both config files)

**Files:**
- `src/admin/config.yml`
- `src/admin/cms/config.yml`

**Change:**
- Add `primary_source` field in `source_documents` fields.
- Keep relation widget as-is (global repository remains intact).
- If thumbnails chosen: add optional `thumbnail` field.
- Optional guardrail: tighten file `accept` to PDFs for primary sources, but this is not minimal if exhibits still need records.

**Dependency impact:**
- Non-breaking; editor UX improvement.

## 4) `documents.11tydata.js` updates

**File:**
- `src/content/documents/documents.11tydata.js`

**Change:**
- No mandatory change for boolean filter approach.
- Optional: add computed defaults (`primary_source` default false/true) and/or `is_primary_source` computed boolean.

**Dependency impact:**
- Optional; if implemented, should align with template predicates.

## 5) Template updates

### 5a) Homepage Evidence Room

**File:**
- `src/content/pages/index.njk`

**Change:**
- Filter source docs to primary only before count/list rendering.
- Update count text to reflect filtered list.

**Dependency impact:**
- Requires documents to carry field or template to provide backward-compatible default.

### 5b) Proof card

**File:**
- `src/_includes/components/proof-card.njk`

**Change (minimal):**
- No required change for correctness.
- Optional: add visual tag when cited doc is non-primary exhibit.

**Dependency impact:**
- None required.

### 5c) Documents archive

**File:**
- `src/content/pages/documents.njk`

**Change options:**
- Minimal strict interpretation of “Evidence Room only”: no change.
- Better UX: split archive into “Primary sources” and “Exhibits” or add filter toggle.

**Dependency impact:**
- Optional.

## 6) New scripts

**Files:** none required for minimal fix.

**Optional:**
- `scripts/generate-thumbnails.mjs` only if choosing semi-auto strategy B.

**Dependency impact:**
- Not needed for minimal plan.

## 7) `eleventy.config.js` collection changes

**File:**
- `eleventy.config.js`

**Change:**
- No mandatory change; template-level filtering is enough.
- Optional cleaner approach: add derived collection `primarySourceDocument` for homepage/archive use.

**Dependency impact:**
- Optional; if templates switch to new collection, collection definition must ship first or together.

---

## Recommended implementation sequence (lowest risk)

1. Add `primary_source` field in both CMS configs.
2. Backfill existing docs with explicit `primary_source` values.
3. Filter Evidence Room homepage list/count to `primary_source`.
4. (Optional) add thumbnail field + template fallback badge.
5. (Optional) add derived Eleventy collection for cleaner reuse.

This sequence preserves existing proof citations and avoids immediate content deletions.

---

## Direct answer to core architecture question

Use a **single global source document repository** (`src/content/documents` + `static/documents`) but add a **classification flag** that distinguishes true primary sources from exhibits/illustrations. Then:

- Keep proof-card source linking exactly as-is (relation widget already works globally).
- Filter the homepage Evidence Room to show only primary sources.
- Keep exhibit records available for citation/history where needed.

That is the smallest change set that fixes the Evidence Room without breaking current proof data.
