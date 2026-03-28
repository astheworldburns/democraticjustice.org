# Accessibility Changes

## Scope
Systematic pass across public templates and components (excluding `src/admin/`).

## Changes made
- Added and standardized skip link copy to "Skip to main content" in base layout.
- Updated skip-link styles under navigation to ensure visible keyboard access on focus.
- Standardized global `*:focus-visible` outline to use `var(--color-accent)`.
- Verified/updated ARIA landmarks:
  - Header nav now uses `aria-label="Main navigation"`.
  - Footer remains semantic `<footer>`.
  - Proof navigation retains `aria-label="Investigation sections"`.
  - TOC aside retains `aria-label="Table of contents"`.
- Added decorative image hiding on header proof-mark (`alt="" aria-hidden="true"`).
- Ensured proof-mark in proof card remains decorative (`alt="" aria-hidden="true"`).
- Updated document card primary link text to include document title.
- Added reduced-motion safeguards at stylesheet end.

## Related quality/performance hardening completed in same pass
- Removed stale CSS block marked as unused.
- Added font preloads for critical Space Grotesk 400 and Source Serif 4 700.
- Ensured external media-chrome script is async and uses crossorigin.
- Added image decoding and dimensions for key `.njk` image tags.
- Added sitemap template at `/sitemap.xml` and robots sitemap entry.
- Added article RSS feed template at `/feed.xml` including title, absolute link, description, pubDate, author, and categories.
