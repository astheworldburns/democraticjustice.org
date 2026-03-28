# Integration Verification Report

Date: 2026-03-28  
Scope: Full repository review requested in Prompt 8A.

## 1) TOKEN COMPLIANCE

### CSS raw color/function scan (`src/assets/css/tailwind.css`)
Method:
- Scanned for raw `#...`, `rgb()`, `rgba()`, `hsl()/hsla()` values.
- Excluded `:root`, `html[data-theme="dark"]`, and all `@font-face` blocks as requested.

Findings:
- **Line 271**: `color: #fff;`

Notes:
- Many `rgb()/rgba()` usages remain outside excluded blocks, but they are tokenized forms (`rgb(var(--token))` / `rgba(var(--token), alpha)`) rather than hard-coded numeric color values.

### Arbitrary Tailwind value patterns in `.njk`
Scanned all `.njk` files in:
- `src/_includes/`
- `src/content/`

Findings:
- `src/_includes/layouts/author.njk:13` → `md:grid-cols-[auto_1fr]`

No additional arbitrary bracket classes (`text-[`, `bg-[`, `border-[`, etc.) were found.

---

## 2) HEADING HIERARCHY

### `src/_includes/layouts/base.njk`
- Direct heading tags in file: **none**
- Acts as wrapper layout; heading structure is provided by child layouts/components.
- Skipped-level finding: **N/A**

### `src/_includes/layouts/post.njk`
- Rendered chain (template + included proof card): `H1 → H2 → H2 → H2 → H3`
  - `H1` from `components/proof-card.njk`
  - `H2` section headers (source docs, narrative, related section header include)
  - `H3` table-of-contents heading / related card titles
- Skipped-level finding: **none**

### `src/_includes/layouts/page.njk`
- Chain: `H1` (plus any headings from page body content)
- Skipped-level finding: **none in layout template itself**

### `src/_includes/layouts/author.njk`
- Chain: `H1 → H2 → H3`
- Skipped-level finding: **none**

### `src/_includes/layouts/document.njk`
- Chain: `H1 → H2`
- Skipped-level finding: **none**

---

## 3) SEMANTIC LANDMARKS

### Required landmarks per layout (`<header>`, `<nav aria-label>`, `<main id="main-content">`, `<footer>`)

- `base.njk`: ✅
  - `<header>` and `<nav aria-label="Main navigation">` provided via `components/header.njk`
  - `<main id="main-content">` present in base
  - `<footer>` provided via `components/footer.njk`

- `post.njk`: ✅ (inherits from base)

- `page.njk`: ✅ (inherits from base)

- `author.njk`: ✅ (inherits from base)

- `document.njk`: ⚠️ mixed
  - Inherits required landmarks from base (so required items exist)
  - Also defines an additional nested `<main id="main-content">` inside the template, resulting in duplicated `id="main-content"` on rendered document pages.

### `<section aria-labelledby>` requirement

- `post.njk`: ✅ all `<section>` elements include `aria-labelledby`
- `index.njk`: ✅ all `<section>` elements include `aria-labelledby`

---

## 4) JSON-LD INVENTORY

Detected `<script type="application/ld+json">` blocks:

- `src/_includes/layouts/base.njk`
  - Block 1: `Organization`, `WebSite` (includes `SearchAction`)
  - Block 2 (article pages): `NewsArticle` (includes nested `Person`, `ImageObject`)

- `src/_includes/layouts/post.njk`
  - Block 1: `BreadcrumbList`
  - Block 2: `ClaimReview` (includes nested `NewsMediaOrganization`, `Rating`, `Claim`, `CreativeWork`)

- `src/_includes/layouts/author.njk`
  - Block: `Person` (includes nested `NewsMediaOrganization`)

- `src/_includes/layouts/document.njk`
  - Block 1: `BreadcrumbList`
  - Block 2: `Dataset` (includes nested `DataDownload`)

Trailing-comma loop check:
- Reviewed Nunjucks loop-comma handling in JSON-LD blocks (`not loop.last` and conditional comma gates).
- **No trailing comma bug found** in current templates.

---

## 5) DARK MODE TOKENS

### `:root` custom properties found (34)

`--page`, `--page-top`, `--surface`, `--surface-strong`, `--surface-muted`, `--ink`, `--ink-soft`, `--ink-muted`, `--rule`, `--rule-strong`, `--accent`, `--accent-soft`, `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`, `--type-headline`, `--type-body`, `--type-ui`, `--type-mono`, `--type-masthead`, `--color-surface`, `--color-surface-elevated`, `--color-surface-overlay`, `--color-ink`, `--color-ink-secondary`, `--color-ink-muted`, `--color-accent`, `--color-accent-subtle`, `--color-border`, `--color-border-subtle`, `--color-glass-bg`, `--color-glass-border`, `--grid-gap`.

### Missing `[data-theme="dark"]` overrides

The following `:root` properties do **not** have explicit dark overrides:
- `--radius-xs`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--type-headline`
- `--type-body`
- `--type-ui`
- `--type-mono`
- `--type-masthead`
- `--grid-gap`

Interpretation:
- These are non-color/shared design tokens (type, radius, spacing), so omission may be intentional.

---

## 6) IMAGE ALT TEXT

Scanned all `.njk` files for `<img ...>` tags.

Findings:
- **No `<img>` tags missing an `alt` attribute**.
- **No decorative `<img alt="">` tags missing `aria-hidden="true"`**.

---

## 7) COMPONENT USAGE

Verified include usage in templates:

- `components/meta-row.njk` → included in multiple templates (e.g., `index.njk`, `post.njk`, `archives.njk`, `categories.njk`, `proof-card.njk`)
- `components/section-header.njk` → included in multiple templates (e.g., `index.njk`, `post.njk`, `documents.njk`, `staff.njk`, `about.njk`, `archives.njk`, `categories.njk`)
- `components/document-card.njk` → included in `post.njk` and `documents.njk`

Result: ✅ all three required components are in active use.

---

## 8) CONTENT PRESERVATION

Verified required collection references in templates:

- `collections.proofArticle` referenced in `src/content/pages/index.njk` ✅
- `collections.sourceDocument` referenced in:
  - `src/content/pages/documents.njk` ✅
  - `src/_includes/components/proof-card.njk` ✅
- `collections.authorProfiles` referenced in:
  - `src/content/pages/index.njk` ✅
  - `src/_includes/layouts/post.njk` ✅
  - `src/content/pages/staff.njk` ✅
- `collections.article` referenced in:
  - `src/content/pages/index.njk` ✅
  - `src/_includes/layouts/post.njk` ✅

Article membership check:
- `src/content/articles/the-takeover-of-the-west-virginia-young-democrats.md` is configured through `articles.11tydata.js`, which always adds the `article` tag via `eleventyComputed.tags`.
- Build output confirms page emission at:
  - `_site/articles/the-takeover-of-the-west-virginia-young-democrats/index.html`

Result: ✅ preserved and currently building into the article route.

---

## 9) BUILD VERIFICATION

Command run: `npm run build`

Status: ✅ **PASS**

Warnings observed:
- npm environment warning:
  - `npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.`
- Asset audit warnings (non-fatal in default mode):
  - Filename style warning: `Seth Headshot.jpg`
  - Format mismatch warning: `wvyd-email.jpg` appears HEIF by bytes
  - Large upload warning: `wvyd-email.jpg` (739.7 KB)

Public surface audit:
- Passed with no unexpected public routes.
