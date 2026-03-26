# Evergreen Copy Audit

Current evergreen and public-facing site copy compiled into one readable review document.

Updated: March 25, 2026

## Excluded On Purpose

This document excludes the current story and proof surfaces. It does not include:

`src/content/articles/**`
`src/_includes/components/proof-card.njk`
`src/_includes/layouts/post.njk`

The goal here is the durable site voice: the brand layer, the public utility pages, the recurring chrome, and the non-article templates.

## Brand Core

Source files:

`src/_data/siteSettings.json`
`src/_data/site.json`

The core brand language currently reads like this:

Site title: `Democratic Justice`

Tagline: `Reporting readers can check.`

Mission statement:

> We publish reporting that readers can inspect from source document to conclusion. Our reporting puts the logic first so readers can judge the conclusion as they read.

Footer description:

> Democratic Justice publishes reporting that readers can inspect from source document to conclusion. Every story stays searchable, citable, and in place.

Standards tagline: `Reported. Sourced. Proved.`

Meta description:

> Democratic Justice publishes reporting with source documents, Proof Cards, and archives readers can search, cite, and revisit.

Site description:

> Reporting on power, elections, parties, and public failure.

Contact email: `proof@democraticjustice.org`

## Global Site Chrome

Source files:

`src/_includes/components/header.njk`
`src/_includes/components/footer.njk`

The global header uses the brand name `Democratic Justice`, the edition line `Edition [current date]`, the theme toggle labels `Night edition` and `Day edition`, and the primary navigation labels `Home`, `About`, `Archives`, `Staff`, `Search`, and `RSS`.

On article pages, the masthead reduces to `Democratic Justice` plus the `Night edition` / `Day edition` toggle.

The footer repeats the brand name and runs this paragraph:

> Democratic Justice publishes reporting that readers can inspect from source document to conclusion. Every story stays searchable, citable, and in place.

The footer contact block uses `Contact`, `proof@democraticjustice.org`, `Follow by RSS`, `Search the archive`, and `Staff directory`. The legal line closes with `All rights reserved.`

## Homepage

Source file:

`src/content/pages/index.njk`

Dynamic story titles, descriptions, bylines, dates, and desk labels are omitted here. What follows is the recurring homepage language around them.

The lead package uses the fallback kicker `Lead report` and the actions `Read the record` and `Browse the archive`.

The mission rail reads:

Mission heading: `Reporting readers can check`

Mission copy:

> We publish reporting that readers can inspect from source document to conclusion. Our reporting puts the logic first so readers can judge the conclusion as they read.

Mission actions:

`Read the mission`
`Follow by RSS`

The desks rail uses the label `Editorial desks` and, when available, the helper label `Latest:`.

The archive section opens with `Archive`, the title `Reporting archive`, and the action `Open archive`.

The method section reads:

Title: `How the reporting works`
Kicker: `Method`

> Each story starts with records, filings, and source documents. The writing states what happened, who acted, and what the record supports.

> Every story opens with a Proof Card. The article that follows shows the reporting behind it.

> Each story keeps a permanent URL, a desk label, and an archive path so readers can search it, cite it, and revisit it.

The support box uses the label `For readers` and says:

> Read the finding, open the documents, and follow the reporting in the same place.

The newsroom section uses the title `Newsroom`.

## About Page

Source file:

`src/content/pages/about.njk`

The page now opens directly as a signed letter rather than a standard prose page.

It opens with:

> To readers,

It also uses the current build date at the top of the letter.

And the body reads:

> Democratic Justice publishes reporting that readers can inspect from source document to conclusion. Each story opens with a Proof Card and carries the source documents behind it.

> The Proof Card comes first for a reason. It states the claim, shows the record, and lays out the logic before the story begins, so readers can judge the conclusion as they read.

> This publication will move when the reporting is ready. Some stretches will be quiet. When Democratic Justice publishes, it should be worth watching for.

> We put our names on work we are willing to defend in public. We report on power, elections, parties, and public failure. We follow records, track money and control, name decisions and decision makers, and keep each story in the archive so it can be searched, cited, and revisited.

> If the work is worth publishing, it should also be worth checking.

The page closes with the typed signoff:

`Seth Sturm`
`Founder and editor`

It also uses:

- `Seth Headshot.jpg`
- `signature-seth.svg` for light mode
- `signature-seth-white.svg` for dark mode

The portrait now sits with the signature at the close of the letter rather than at the top.

## Archives Page

Source file:

`src/content/pages/archives.njk`

The page uses the kicker `Archive`, the title `Reporting archive`, and this description:

> Published reporting, grouped by year and month.

The utility box uses `Jump by year`.

The right-side tools use the label `Archive` and the actions `Search the reporting` and `Follow by RSS`.

Month grouping remains dynamic, including the labels `month` and `months`.

## Desk / Category Pages

Source file:

`src/content/pages/categories.njk`

Desk pages use `Editorial desk` as the kicker and this standard description pattern:

> Stories filed under the [desk] desk. New work appears first. Older work stays in the archive.

They also use the labels `piece`, `pieces`, `Latest`, `Archive`, and `Other desks`.

The archive actions are `Monthly archive` and `Search`.

The lead package uses the fallback kicker `Lead report` and the action `Read the lead report`.

## Search Page

Source file:

`src/content/pages/search.njk`

The page uses `Archive search` as the kicker and `Search the reporting archive` as the title.

The description reads:

> Search the archive by name, subject, desk, or date.

The helper label is `Search tips`, followed by:

> Start with a name, subject, organization, or desk. Follow the results into the archive.

The search placeholder remains `Search the archive`.

## Staff Directory Page

Source file:

`src/content/pages/staff.njk`

The staff directory uses `Newsroom` as the kicker and `Staff` as the title.

Its description reads:

> Reporter bios, beats, and recent work. Every byline follows the same standards and appears in the same archive.

Reporter cards also use the label `published`.

## Staff Profile Template

Source files:

`src/_includes/layouts/author.njk`
`src/content/authors/seth-sturm.md`

The profile template uses `Newsroom` as the page kicker.

Its side rail uses `Published`, `Primary desks`, and `Contact`. The contact links are `Email`, `Bluesky`, and `X`.

The reporting section uses the title `Recent reporting` and the label `By [name]`.

Hidden search metadata uses `Staff profile`.

The current live Seth Sturm profile reads:

Name: `Seth Sturm`
Role: `Investigations Editor`

Short bio:

> Reporting on political accountability, public power, and democratic institutions.

Full bio:

> Seth Sturm reports on public accountability, institutional power, and the mechanics that shape democracy in West Virginia and nationally.

## RSS Guide Page

Source file:

`src/content/pages/rss.njk`

The RSS guide uses `Follow` as the kicker and `Follow by RSS` as the title.

Its description reads:

> RSS sends new stories straight to your reader.

The primary actions are `Copy feed URL`, `Open feed URL`, and `Browse the archive`.

The setup section uses `Get started` and runs in three steps:

Step 1: `Copy the feed URL`

> Copy the Democratic Justice feed address.

Step 2: `Add it to your reader`

> Use the add-feed or subscribe-by-URL option in your reader.

Step 3: `Read new stories there`

> New stories appear in your reader when they are published.

The feed URL section says:

> Paste this address into your reader:

The closing section, `Why we offer it`, says:

> RSS gives readers a direct line to new stories.

> It keeps the archive easy to follow over time.

The right-side box uses `What you get` and includes:

> New stories in one feed.

> A permanent URL for each story.

> A simple way to follow the archive.

## Browser-Rendered Feed View

Source file:

`src/assets/feed.xsl`

When `/feed.xml` opens in a browser, the main visible copy is:

Title: `RSS feed`

Theme toggle: `Night edition` / `Day edition`

Actions: `RSS guide` and `Homepage`

Intro:

> This page is the live feed for Democratic Justice. Use the RSS guide if you want setup help.

Note:

> Paste this feed URL into your RSS reader:

## Source Document Page Template

Source file:

`src/_includes/layouts/document.njk`

The source document template uses `Source Document` as the kicker and the following utility labels:

`Open file`
`Download`
`Preview unavailable`
`Document record`
`Obtained`
`Source method`
`File URL`

Its fallback preview copy reads:

> Open the file directly from the link above.

## Generic Page Template Copy

Source file:

`src/_includes/layouts/page.njk`

The generic page template still has one fallback label:

`Background`

## Audit Notes

The main pressure points for a deeper brand rewrite are still the same:

`src/_data/siteSettings.json`
`src/content/pages/index.njk`
`src/content/pages/about.md`
`src/_includes/components/header.njk`
`src/_includes/components/footer.njk`
`src/content/pages/rss.njk`
`src/assets/feed.xsl`

Those files carry most of the site’s recurring institutional voice.
