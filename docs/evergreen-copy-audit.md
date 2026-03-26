# Evergreen Copy Audit

Current evergreen/public-facing copy pulled into one review document for brand and positioning work.

Updated: March 25, 2026

## Excluded On Purpose

The following are intentionally not included in this audit because they are tied to the current test story/proof:

- `src/content/articles/**`
- `src/_includes/components/proof-card.njk`
- `src/_includes/layouts/post.njk`

This document focuses on evergreen site copy, public page framing, recurring UI language, and durable non-article content.

## Brand Core

Source files:

- `src/_data/siteSettings.json`
- `src/_data/site.json`

Visible and strategic brand copy:

- Site title: `Democratic Justice`
- Tagline: `Proof journalism for democratic accountability`
- Mission statement:

  > Democratic Justice publishes accountability reporting built to endure. When an investigation carries a Proof Card, every axiom is sourced, every inference is explicit, and the conclusion is stated plainly, defended openly, and owned without hedging.

- Footer description:

  > Democratic Justice is building PROOF journalism: document-based investigations, durable archives, and structured proofs that let readers examine every source, every foundational fact, and every inferential step.

- Standards tagline: `Reported. Sourced. Proved.`
- Meta description:

  > Democratic Justice is a proof journalism outlet publishing accountability reporting, source documents, and formal Proof Cards grounded in documented facts.

- Site description:

  > Investigative journalism and political accountability reporting rooted in West Virginia.

- Legacy site tagline:

  > Investigative journalism and political accountability reporting rooted in West Virginia

- Contact email: `proof@democraticjustice.org`

## Global Site Chrome

Source files:

- `src/_includes/components/header.njk`
- `src/_includes/components/footer.njk`

### Header

Non-article pages:

- `Democratic Justice`
- `Edition [current date]`
- `Night edition`
- `Day edition`
- `Home`
- `About`
- `Archives`
- `Staff`
- `Search`
- `RSS`

Article pages:

- `Democratic Justice`
- `Night edition`
- `Day edition`

### Footer

- `Democratic Justice`
- Footer paragraph:

  > Democratic Justice is building PROOF journalism: document-based investigations, durable archives, and structured proofs that let readers examine every source, every foundational fact, and every inferential step.

- `Contact`
- `proof@democraticjustice.org`
- `Follow by RSS`
- `Search the archive`
- `Staff directory`
- `All rights reserved.`

## Homepage

Source file:

- `src/content/pages/index.njk`

Dynamic article titles, decks, dates, bylines, and desk labels are omitted here. Static homepage copy:

### Lead / mission area

- `Lead report`
- `Read the record`
- `Browse the archive`
- `Mission`
- `Reporting meant to hold up over time`
- Mission rail paragraph:

  > Democratic Justice covers public power, party machinery, elections, and accountability failures with document-based reporting rooted in West Virginia.

- `Read the mission`
- `Follow by RSS`
- `Editorial desks`
- `Latest:`

### Archive section

- `Archive`
- `Reporting archive`
- `Open archive`

### Standards section

- `Reporting standards`
- `Method`
- `Records`
- `Documented`

  > Reporting starts with records, filings, source documents, and traceable claims that can be checked after publication.

- `Copy`
- `Tight`

  > Stories are written for clarity, attribution, and durable reading rather than the churn and posture of social feeds.

- `Accountability`
- `Named`

  > Power, institutions, parties, and decision makers are identified directly so responsibility is never blurred into process language.

- `Archive`
- `Durable`

  > Each piece is published with permanent routing, desk taxonomy, and searchable archives so the reporting keeps its value after the first wave.

### Newsroom section

- `Newsroom`

## About Page

Source file:

- `src/content/pages/about.md`

- Kicker: `Publication`
- Title: `About`
- Description:

  > Learn more about Democratic Justice and its reporting mission.

- Intro:

  > Democratic Justice is an investigative journalism publication focused on political accountability, public power, elections, and institutional failure in West Virginia. The mission is simple: produce reporting that can be checked, cited, archived, and revisited long after the news cycle moves on.

  > The publication is being built to grow beyond any single voice. Reporters, editors, archives, and editorial desks are structured so the authority of the work comes from verification, clarity, and consistency rather than personality alone.

- Section: `Mission`

  > The newsroom exists to document how power is exercised, shielded, and justified. That includes the mechanics of parties, institutions, campaigns, public agencies, and the people who run them.

  > The standard is not speed for its own sake. It is durable reporting with enough context and structure that readers can return to it, search it, and use it.

- Section: `Coverage Priorities`

  > The reporting focus is direct:

  - `Follow public records.`
  - `Track money, patronage, and institutional control.`
  - `Name decisions, decision makers, and the consequences that follow.`
  - `Preserve findings in archives organized by desk, date, and byline.`

- Section: `Standards`

  > The editorial approach is built around a few non-negotiables:

  - `Lead with the strongest verified fact.`
  - `Attribute assertions clearly and avoid soft, evasive language.`
  - `Keep copy tight enough to read cleanly and detailed enough to stand up to scrutiny.`
  - `Publish in a form that remains accessible, searchable, and portable.`

- Section: `Why The Site Is Built This Way`

  > Democratic Justice uses a static publishing stack so the reporting remains fast, portable, and resistant to platform dependency. The design favors legibility, restraint, and durable archives over the short half-life of algorithmic feeds.

  > This is a publication designed for accumulation. Stories should not disappear into a timeline. They should compound into a body of work.

## Archives Page

Source file:

- `src/content/pages/archives.njk`

Static copy:

- `Archive`
- `Reporting archive`
- Description:

  > A chronological record of published reporting, grouped by year and month so the archive grows like a newsroom index instead of a stack of forgotten posts.

- `Jump by year`
- `Archive tools`
- `Search the reporting`
- `Read the feed`
- Dynamic structural labels:
  - `month`
  - `months`

## Desk / Category Pages

Source file:

- `src/content/pages/categories.njk`

Static copy:

- `Editorial desk`
- Description pattern:

  > Reporting and analysis grouped under the [desk] desk, with the newest filing surfaced first and older work retained as a durable archive.

- `piece`
- `pieces`
- `Latest`
- `Navigate the archive`
- `Monthly archive`
- `Search`
- `Other desks`
- Lead fallback: `Lead filing`
- Lead CTA: `Read the desk lead`

## Search Page

Source file:

- `src/content/pages/search.njk`

Static copy:

- `Archive search`
- `Search the reporting archive`
- Description:

  > Full-text search runs entirely on the static site, so readers can move through the archive without relying on an external search service or a database-backed app.

- `Desk filters`

  > Filter the archive by editorial desk, author, or publication year as the index grows.

- `No hosted backend`

  > Search results are generated from the built site itself, keeping the stack portable and low-friction.

- `Reader workflow`

  > Use search when you know the subject, then jump into desks and archives once you’ve found the thread.

- Search placeholder: `Search the archive`

## Staff Directory Page

Source file:

- `src/content/pages/staff.njk`

Static copy:

- `Newsroom`
- `Staff`
- Description:

  > Reporter bios, beats, and recent work. Democratic Justice is organized so every byline is attached to consistent standards, searchable archives, and a publication-wide editorial frame.

- `published`

## Staff Profile Template

Source files:

- `src/_includes/layouts/author.njk`
- `src/content/authors/seth-sturm.md`

Template/static copy:

- `Newsroom`
- `Reporting brief`
- `Published reports currently attached to this byline.`
- `Primary desks`
- `Reach the desk`
- `Email`
- `Bluesky`
- `X`
- `Recent reporting`
- `By [name]`
- Hidden/search metadata labels:
  - `Staff profile`

Current live profile copy for Seth Sturm:

- Name: `Seth Sturm`
- Role: `Investigations Editor`
- Short bio:

  > Reporting on political accountability, public power, and democratic institutions.

- Full bio:

  > Seth Sturm reports on public accountability, institutional power, and the mechanics that shape democracy in West Virginia and nationally.

## RSS Guide Page

Source file:

- `src/content/pages/rss.njk`

Static copy:

- Kicker: `Follow`
- `Follow by RSS`
- Description:

  > RSS is the simplest way to follow Democratic Justice without relying on social feeds or algorithms. You subscribe once, and new stories appear automatically in your reader.

- `Copy feed URL`
- `Feed URL copied`
- `Open feed URL`
- `Browse the archive`

- Section: `How it works`
  - `Step 1`
  - `Copy the feed URL`
  - `Use the button above to copy the Democratic Justice feed address.`
  - `Step 2`
  - `Paste it into any RSS reader`
  - `Most feed readers have an "Add feed" or "Subscribe by URL" option. Paste the address there.`
  - `Step 3`
  - `Read new stories automatically`
  - `Whenever Democratic Justice publishes, the new story will appear in your reader without platform interference.`

- Section: `Feed URL`

  > This is the address you paste into a feed reader:

- Section: `Why we offer it`

  > Democratic Justice is built for readers who want durable reporting, not platform churn. RSS keeps that relationship direct.

  > If you use the feed, you get the publication as a stream of records: no ranking, no suppression, no recommendation engine standing between you and the work.

- Sidebar: `What you get`
  - `Full-story entries from the publication feed.`
  - `A permanent URL you can archive or cite.`
  - `A direct publishing channel independent of social platforms.`

## Browser-Rendered Feed View

Source file:

- `src/assets/feed.xsl`

Visible copy in `/feed.xml` when opened in a browser:

- `RSS Feed`
- `Homepage`
- `Night edition`
- `Day edition`
- Main intro:

  > This is the machine-readable RSS feed for Democratic Justice. If you were expecting a normal webpage, start with the RSS guide instead.

- `How to use RSS`
- `Open site`
- Note:

  > Paste this feed URL into any RSS reader to subscribe:

## Source Document Page Template

Source file:

- `src/_includes/layouts/document.njk`

Static copy:

- `Source Document`
- `Open original file`
- `Download`
- `Preview unavailable`
- `This source document can be opened directly from the file link above.`
- `Document record`
- `Obtained`
- `Source method`
- `File URL`

## Generic Page Template Copy

Source file:

- `src/_includes/layouts/page.njk`

Fallback/static template copy:

- Default kicker: `Background`

## Audit Notes

The biggest concentration points for positioning language are:

1. `src/_data/siteSettings.json`
2. `src/content/pages/index.njk`
3. `src/content/pages/about.md`
4. `src/_includes/components/header.njk`
5. `src/_includes/components/footer.njk`
6. `src/content/pages/rss.njk`
7. `src/assets/feed.xsl`

If the next phase is a wording overhaul, those files will carry most of the change.
