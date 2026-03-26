# Evergreen Copy Audit

Current evergreen and public-facing site copy compiled into one review document.

Updated: March 25, 2026

## Excluded On Purpose

The following are intentionally not included in this audit because they belong to the current story/proof surface rather than the evergreen site:

- `src/content/articles/**`
- `src/_includes/components/proof-card.njk`
- `src/_includes/layouts/post.njk`

This document covers recurring site chrome, public utility pages, evergreen brand copy, and durable non-article templates.

## Brand Core

Source files:

- `src/_data/siteSettings.json`
- `src/_data/site.json`

Current brand copy:

- Site title: `Democratic Justice`
- Tagline: `Reporting readers can check.`
- Mission statement:

  > Democratic Justice publishes reporting that readers can inspect from source document to conclusion. Every story opens with a Proof Card and carries the record behind it.

- Footer description:

  > Democratic Justice publishes reporting that readers can inspect from source document to conclusion. Every story stays searchable, citable, and in place.

- Standards tagline: `Reported. Sourced. Proved.`
- Meta description:

  > Democratic Justice publishes reporting with source documents, Proof Cards, and archives readers can search, cite, and revisit.

- Site description:

  > Reporting on power, elections, parties, and public failure.

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

  > Democratic Justice publishes document-based reporting with source records, clear findings, and archives readers can search, cite, and revisit.

- `Contact`
- `proof@democraticjustice.org`
- `Follow by RSS`
- `Search the archive`
- `Staff directory`
- `All rights reserved.`

## Homepage

Source file:

- `src/content/pages/index.njk`

Dynamic story titles, descriptions, bylines, dates, and desk labels are omitted here. Static homepage copy:

### Lead / mission area

- Lead fallback kicker: `Lead report`
- CTA: `Read the record`
- CTA: `Browse the archive`
- `Mission`
- `Reporting readers can check`
- Mission rail paragraph:

  > Every story opens with a Proof Card and carries the source documents behind it. We report on power, elections, parties, and public failure.

- `Read the mission`
- `Follow by RSS`
- `Editorial desks`
- `Latest:`

### Archive section

- `Archive`
- `Reporting archive`
- `Open archive`

### Method section

- `How the reporting works`
- `Method`

Main copy:

> Each story starts with records, filings, and source documents. The writing states what happened, who acted, and what the record supports.

> Every story opens with a Proof Card. The article that follows shows the reporting behind it.

> Each story keeps a permanent URL, a desk label, and an archive path so readers can search it, cite it, and revisit it.

Support box:

- `For readers`

  > Read the finding, open the documents, and follow the reporting in the same place.

### Newsroom section

- `Newsroom`

## About Page

Source file:

- `src/content/pages/about.md`

- Kicker: `Publication`
- Title: `About`
- Description:

  > What Democratic Justice publishes and how the reporting works.

Intro:

> Democratic Justice is an investigative reporting publication.

> We publish reporting that readers can check, cite, search, and revisit.

> Every story opens with a Proof Card and carries the source documents behind it.

Section: `Mission`

> We publish reporting that readers can inspect from source document to conclusion.

> The reporting follows power, elections, parties, and public failure. It starts with records, names who acted, and shows how we reached the conclusion.

Section: `Coverage Priorities`

> We follow public records, track money and control, name decisions and decision makers, attach the source documents, and keep each story in the archive by desk, date, and byline.

Section: `Standards`

> Lead with the strongest verified fact. Attribute claims clearly. Keep the writing clear and detailed enough to withstand scrutiny. Keep every story searchable and citable.

Section: `Why The Site Works This Way`

> The site is there for reading, search, and return. Stories stay in place. Links stay usable. The archive grows one story at a time.

## Archives Page

Source file:

- `src/content/pages/archives.njk`

Static copy:

- `Archive`
- `Reporting archive`
- Description:

  > Published reporting, grouped by year and month.

- `Jump by year`
- `Archive`
- `Search the reporting`
- `Follow by RSS`

Dynamic structural labels:

- `month`
- `months`

## Desk / Category Pages

Source file:

- `src/content/pages/categories.njk`

Static copy:

- `Editorial desk`
- Description pattern:

  > Stories filed under the [desk] desk. New work appears first. Older work stays in the archive.

- `piece`
- `pieces`
- `Latest`
- `Archive`
- `Monthly archive`
- `Search`
- `Other desks`
- Lead fallback: `Lead report`
- Lead CTA: `Read the lead report`

## Search Page

Source file:

- `src/content/pages/search.njk`

Static copy:

- `Archive search`
- `Search the reporting archive`
- Description:

  > Search the archive by name, subject, desk, or date.

- `Search tips`

  > Start with a name, subject, organization, or desk. Follow the results into the archive.

- Search placeholder: `Search the archive`

## Staff Directory Page

Source file:

- `src/content/pages/staff.njk`

Static copy:

- `Newsroom`
- `Staff`
- Description:

  > Reporter bios, beats, and recent work. Every byline follows the same standards and appears in the same archive.

- `published`

## Staff Profile Template

Source files:

- `src/_includes/layouts/author.njk`
- `src/content/authors/seth-sturm.md`

Template/static copy:

- `Newsroom`
- `Published`
- `Stories under this byline.`
- `Primary desks`
- `Contact`
- `Email`
- `Bluesky`
- `X`
- `Recent reporting`
- `By [name]`

Hidden/search metadata labels:

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

  > RSS sends new stories straight to your reader.

- `Copy feed URL`
- `Feed URL copied`
- `Open feed URL`
- `Browse the archive`

Section: `Get started`

- `Step 1`
- `Copy the feed URL`
- `Copy the Democratic Justice feed address.`
- `Step 2`
- `Add it to your reader`
- `Use the add-feed or subscribe-by-URL option in your reader.`
- `Step 3`
- `Read new stories there`
- `New stories appear in your reader when they are published.`

Section: `Feed URL`

> Paste this address into your reader:

Section: `Why we offer it`

> RSS gives readers a direct line to new stories.

> It keeps the archive easy to follow over time.

Sidebar: `What you get`

- `New stories in one feed.`
- `A permanent URL for each story.`
- `A simple way to follow the archive.`

## Browser-Rendered Feed View

Source file:

- `src/assets/feed.xsl`

Visible copy in `/feed.xml` when opened in a browser:

- `RSS feed`
- `Homepage`
- `Night edition`
- `Day edition`
- Main intro:

  > This page is the live feed for Democratic Justice. Use the RSS guide if you want setup help.

- `RSS guide`
- `Homepage`
- Note:

  > Paste this feed URL into your RSS reader:

## Source Document Page Template

Source file:

- `src/_includes/layouts/document.njk`

Static copy:

- `Source Document`
- `Open file`
- `Download`
- `Preview unavailable`
- `Open the file directly from the link above.`
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

The main concentration points for evergreen positioning and brand language are:

1. `src/_data/siteSettings.json`
2. `src/content/pages/index.njk`
3. `src/content/pages/about.md`
4. `src/_includes/components/header.njk`
5. `src/_includes/components/footer.njk`
6. `src/content/pages/rss.njk`
7. `src/assets/feed.xsl`

If the next phase is a deeper copy overhaul, those files still carry most of the site’s institutional voice.
