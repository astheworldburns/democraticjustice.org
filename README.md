# Democratic Justice

**Proof-First Investigative Journalism** — [democraticjustice.org](https://democraticjustice.org)

## Overview
DemocraticJustice.org is a digital investigative newsroom. Every investigation follows the Proof-First methodology: documented Axioms → logical Inferences → Source Documents → Reported Narrative.

## Tech Stack
- **Build:** Eleventy v3 (Nunjucks + Markdown)
- **Styling:** Tailwind CSS with semantic design tokens
- **CMS:** Sveltia CMS + GitHub backend
- **Search:** Pagefind
- **API:** Cloudflare Workers (proof-desk-gateway)
- **Interactivity:** Vanilla JS (theme, scroll nav, document overlay)

## Design System

### Fonts
- **Serif (headlines):** Source Serif 4 (400, 400i, 600, 700)
- **Sans (body):** Space Grotesk (400, 500, 600, 700)
- **Mono (metadata):** IBM Plex Mono (500)

### Type Scale
2xs → xs → sm → base → lg → xl → 2xl → 3xl → 4xl → 5xl → 6xl + display-sm/md/lg (fluid)

### Colors
Semantic CSS custom properties with light/dark themes. Defined in `src/assets/css/tailwind.css` `:root` and `[data-theme="dark"]`. Mapped to Tailwind via `tailwind.config.js`.

### Layout
Bento Grid: 12-column asymmetric grid (860px+), 6-column tablet, single-column mobile. Gap: `var(--grid-gap)`.

## Components

| Component | File | Purpose |
|---|---|---|
| Header | `components/header.njk` | Site masthead + nav + theme toggle |
| Footer | `components/footer.njk` | Global footer |
| Proof Card | `components/proof-card.njk` | Bento proof layout (axioms, logic, documents) |
| Card | CSS class `.card` | Shared card primitive (default, featured, compact) |
| Meta Row | `components/meta-row.njk` | Byline/date/desk metadata |
| Section Header | `components/section-header.njk` | Kicker + heading pair |
| Document Card | `components/document-card.njk` | Source document display card |
| Podcast Player | `components/podcast-player.njk` | Media player embed |

## Content Model
See `docs/CONTENT-MODEL.md` for full field-level documentation.

### Adding an Investigation
1. Create `src/content/articles/your-slug.md` with frontmatter: kicker, title, description, author (slug), date, tags, proof (issue, axioms, logic, inference, conclusion)
2. Create source documents as `src/content/documents/doc-slug.md` with: title, file, description, obtained, source_method
3. Reference documents in article axioms via `sources[].document_url: "/documents/doc-slug/"`
4. Run `npm run build`

## Layouts

| Layout | Route | Structured Data |
|---|---|---|
| `base.njk` | All pages | Organization, WebSite |
| `post.njk` | `/articles/*` | NewsArticle, BreadcrumbList, ClaimReview |
| `document.njk` | `/documents/*` | Dataset, DataDownload, BreadcrumbList |
| `author.njk` | `/staff/*` | Person |
| `page.njk` | Static pages | — |
| `podcast-episode.njk` | `/podcast/*` | — |

## Accessibility
WCAG 2.1 AA. Skip nav, focus-visible indicators, semantic landmarks, proper heading hierarchy, reduced-motion support, dark mode, alt text policy. See `docs/ACCESSIBILITY-CHANGES.md`.

## Performance
Self-hosted fonts with preload + font-display:swap. Lazy images with width/height. Tailwind purge. Vanilla JS (~4KB). Glassmorphism with @supports fallbacks.

## Deploy
GitHub Actions (`.github/workflows/r2-sync.yml`) syncs to Cloudflare R2. Proof API via Cloudflare Worker (`workers/proof-desk-gateway/`).

## Documentation
- `docs/CONTENT-MODEL.md`
- `docs/ACCESSIBILITY-CHANGES.md`
- `docs/VERIFICATION.md`
