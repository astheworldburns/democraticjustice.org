# Evergreen Copy Audit

Current evergreen and public-facing site copy compiled into one readable review document.

Updated: March 26, 2026

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

Tagline: `Proof before prose.`

Mission statement:

> Every story opens with a Proof Card and the source documents behind it. Readers get the reasoning before the narrative.

Footer description:

> Democratic Justice publishes investigative work with Proof Cards and source documents so readers can test the case for themselves.

Standards tagline: `Reported. Sourced. Proved.`

Meta description:

> Democratic Justice publishes investigative work with Proof Cards, source documents, and reporting readers can test for themselves.

Site description:

> Investigative work with Proof Cards and source documents.

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

The primary navigation now also includes `Subscribe`.

## Homepage

Source file:

`src/content/pages/index.njk`

Dynamic story titles, descriptions, bylines, dates, and desk labels are omitted here. What follows is the recurring homepage language around them.

The lead package uses the fallback kicker `Lead report` and the actions `Read the record` and `Browse the archive`.

The mission rail reads:

Mission heading: `Proof before prose`

Mission copy:

> Every story opens with a Proof Card and the source documents behind it. Readers get the reasoning before the narrative.

Mission actions:

`Read the letter`
`Follow by RSS`

The desks rail uses the label `Editorial desks` and, when available, the helper label `Latest:`.

The archive section opens with `Archive`, the title `Reporting archive`, and the action `Open archive`.

The newsroom section uses the title `Newsroom`.

## Subscribe Page

Source file:

`src/content/pages/subscribe.njk`

The page uses `Subscribe` as the kicker and title and this description:

> Get an email when new Democratic Justice work is ready.

The body reads:

> Democratic Justice may go quiet for a while. Subscribe if you want to know when new work is ready.

It uses a Buttondown-backed form with the field label `Email address` and the submit action `Subscribe`.

It closes with:

> We do not send daily churn. We send new work when it is finished.

> You can also follow by RSS if you would rather keep the site in your reader than your inbox.

## About Page

Source file:

`src/content/pages/about.njk`

The page now opens directly as a signed letter rather than a standard prose page.

It opens with:

> To readers,

It also uses the current build date at the top of the letter.

And the body reads:

> Imagine a world where every journalist were confident enough to put their reasoning and source documents before their work.

> Right now, the internet is drowning in clickbait noise. Thousands of articles are churned out every hour just to pad ad revenue. The noise is becoming impossible to separate from reality, and it trains people to react emotionally rather than logically.

> Democratic Justice exists to fight that trend with proof-based journalism.

> Every story we publish opens with a Proof Card. Before you read a single line of narrative prose, we hand you the foundation of facts, our exact reasoning, and the conclusion we reached. You get to test the case yourself before our writing ever has a chance to influence you.

> Because we refuse to churn out content just to feed an algorithm, months might pass between stories. But when an email from Democratic Justice hits your inbox, you will know that it has been rigorously sourced and tested.

> Misinformation spreads in darkness, so we're betting everything on radical transparency.

The page closes with the typed signoff:

`Seth Sturm`
`Founder and editor`

It also uses:

- `Seth Headshot.jpg`
- `signature-seth.svg` for light mode
- `signature-seth-white.svg` for dark mode

The portrait now sits with the signature at the close of the letter rather than at the top.

## Privacy Page

Source file:

`src/content/pages/privacy.njk`

The page uses `Legal` as the kicker, `Privacy` as the title, and this description:

> What this site collects and why.

The body explains that Democratic Justice does not use the site to build advertising profiles, stores the reader's edition preference locally, handles reader email as correspondence, relies on infrastructure providers including Cloudflare for hosting and security, and will name any analytics provider before privacy-first site analytics go live.

It closes with:

> If you have questions about privacy or want to reach us about your data, email proof@democraticjustice.org.

## Cookies Page

Source file:

`src/content/pages/cookies.njk`

The page uses `Legal` as the kicker, `Cookies` as the title, and this description:

> What this site stores in your browser.

The body explains that the site keeps cookies and browser storage to a minimum, uses local storage to remember the reader's edition preference, may rely on strictly necessary provider-side cookies or similar technologies for hosting and security, and does not use advertising cookies.

It also states:

> If we add analytics or any other non-essential cookie-based tool, we will disclose it here before it goes live and add consent controls where the law requires them.

## Archives Page

Source file:

`src/content/pages/archives.njk`

The page uses the kicker `Archive`, the title `Reporting archive`, and this description:

> This is the public record of what we have published. Each story stays in place.

The header actions use `Search the archive` and `Follow by RSS`.

Year chips appear directly in the header for fast jumps.

Month grouping remains dynamic, including the labels `month` and `months`.

## Desk / Category Pages

Source file:

`src/content/pages/categories.njk`

Desk pages use `Editorial desk` as the kicker and this standard description pattern:

> This desk collects reporting filed under the [desk] desk. New work appears first and the rest stays in the archive.

They also use the labels `piece`, `pieces`, `Latest`, `Archive`, and `Other desks`.

The archive actions are `Open archive` and `Search the archive`.

The lead package uses the fallback kicker `Lead report` and the action `Read the lead report`.

## Search Page

Source file:

`src/content/pages/search.njk`

The page uses `Archive search` as the kicker and `Search the archive` as the title.

The description reads:

> Search by name, subject, desk, or date.

The helper copy reads:

> Start with a name, subject, organization, or desk. Each result stays tied to the full story.

The search placeholder remains `Search the archive`.

## Staff Directory Page

Source file:

`src/content/pages/staff.njk`

The staff directory uses `Newsroom` as the kicker and `Staff` as the title.

Its description reads:

> These are the bylines behind Democratic Justice. Each reporter's work stays in one archive.

Reporter cards also use the label `published`.

## Staff Profile Template

Source files:

`src/_includes/layouts/author.njk`
`src/content/authors/seth-sturm.md`

The profile template uses `Newsroom` as the page kicker.

Its side rail uses `Published` and `Contact`. The contact links are `Email`, `Bluesky`, and `X`.

The reporting section uses the title `Recent reporting` and the label `By [name]`.

Hidden search metadata uses `Staff profile`.

The current live Seth Sturm profile reads:

Name: `Seth Sturm`
Role: `Investigations Editor`

Short bio:

> Seth Sturm reports on power, politics, and public failure.

Full bio:

> Seth Sturm reports on power, party politics, elections, and the records behind public claims.

## RSS Guide Page

Source file:

`src/content/pages/rss.njk`

The RSS guide uses `Follow` as the kicker and `Follow by RSS` as the title.

Its description reads:

> RSS is the cleanest way to follow Democratic Justice.

The primary actions are `Copy feed URL`, `Open feed URL`, and `Browse the archive`.

The body now runs as short prose:

> Copy the feed URL and add it to your reader once. New work appears there when it is published.

> Most readers have an add-feed or subscribe-by-URL field. Paste the address and save it.

The feed URL section says:

> Paste this address into your reader:

The closing section says:

> This site may go quiet for a while. The feed will too. When something new appears, it is because the reporting is finished.

## Browser-Rendered Feed View

Source file:

`src/assets/feed.xsl`

When `/feed.xml` opens in a browser, the main visible copy is:

Title: `RSS feed`

Theme toggle: `Night edition` / `Day edition`

Actions: `RSS guide` and `Homepage`

Intro:

> This is the live Democratic Justice feed. Use it if you want new work without the noise.

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
