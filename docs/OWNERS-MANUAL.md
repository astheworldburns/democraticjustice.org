# Democratic Justice Owner's Manual

This document is the operations handbook for `democraticjustice.org`.

It is written for the owner, editor, maintainer, or technical operator of the site. It covers:

- what the platform is
- what third-party services it depends on
- what still needs owner setup
- how day-to-day publishing works
- how deployments, search, feeds, and bylines behave
- how to troubleshoot and recover from mistakes

This file lives in `docs/` so it is versioned with the repository but is not published on the public site.

## 1. Platform Summary

Democratic Justice is a static publishing platform built for investigative journalism and political accountability reporting.

Core characteristics:

- no database
- no WordPress-style admin backend
- content stored as files in Git
- site generated with Eleventy
- deployed as static files to Cloudflare Pages
- editorial interface provided by Sveltia CMS
- static search powered by Pagefind
- full-content RSS feed for syndication and email automation

Current repository:

- GitHub repo: `astheworldburns/democraticjustice.org`
- Production branch: `main`
- Remote: `https://github.com/astheworldburns/democraticjustice.org.git`

## 2. Architecture At A Glance

### Build flow

1. Content changes are committed to GitHub.
2. Cloudflare Pages pulls `main`.
3. Eleventy builds the site into `_site/`.
4. Tailwind CSS is compiled during the Eleventy build hook.
5. Pagefind indexes the generated site after build.
6. Cloudflare deploys the static output globally.

### Content flow

1. Authors and articles live as Markdown files in `src/content/`.
2. Sveltia CMS writes those files directly into the repo.
3. Eleventy collections generate:
   - homepage
   - article pages
   - staff pages
   - category pages
   - archives
   - RSS feed
   - search index

### Important directories

- `src/content/articles/`: article Markdown files
- `src/content/authors/`: author profile files
- `src/content/pages/`: site pages like home, archives, search
- `src/_includes/layouts/`: page layouts
- `src/_includes/components/`: header/footer partials
- `src/admin/`: Sveltia CMS
- `src/assets/`: CSS and uploaded assets
- `_site/`: generated build output
- `docs/`: internal documentation only

## 3. Third-Party Services

### Already part of the working stack

- GitHub
- Cloudflare Pages
- Sveltia CMS
- Buttondown
- locally served `@fontsource` fonts

### Present in code, but still requires owner setup

#### Sveltia CMS authentication

Status: not fully finished for a newsroom workflow.

What exists now:

- `/admin/` is in the project
- `src/admin/config.yml` points to GitHub as the backend
- content schema for authors and articles is already in place

What still needs owner action:

1. Deploy the Sveltia auth helper to Cloudflare Workers.
2. Create a GitHub OAuth App.
3. Add the Worker URL as `base_url` under the `backend:` section in `src/admin/config.yml`.
4. Invite contributors to the GitHub repo as collaborators if they need publishing access.

Without this, the CMS is not ready for non-technical multi-author use.

#### Contact email

Status: placeholder present in site data.

Current value:

- `proof@democraticjustice.org`

Recommended owner action:

1. Create or confirm the mailbox.
2. Set up delivery using your email provider or Cloudflare Email Routing.
3. Test sending and receiving.

#### Buttondown

Status: connected for site signup and local draft generation.

What already exists:

- a subscribe page that posts to Buttondown
- a local draft workflow driven by `npm run newsletter:draft`
- a full-content RSS feed at `/feed.xml`

What owner action is needed:

1. Keep sender identity, reply handling, and mailing address configured correctly in Buttondown.
2. Keep the custom sending domain verified.
3. Test previews and scheduled sends after any major template or domain change.
4. Keep the local API key only on trusted machines.

#### Data visualization platforms

Optional tools that fit this architecture:

- Datawrapper
- Flourish

These are not yet integrated, but can be embedded into articles when needed.

#### Comments

Optional tool:

- Utterances

This is not installed. It is the best fit if you want lightweight GitHub-backed comments later.

#### Analytics

Not installed.

If analytics are needed, use a privacy-first tool such as Cloudflare Web Analytics rather than a heavy ad-tech stack.

## 4. Current Open Setup Items

As of this manual, the main owner-controlled tasks still open are:

- complete Sveltia auth for Cloudflare Workers + GitHub OAuth
- make sure `proof@democraticjustice.org` is real and monitored
- replace sample/demo content with real reporting
- add additional author profiles if the newsroom grows
- decide whether to add analytics

## 5. Local Development

### Required runtime

- Node `22.16.0`

Pinned locally in:

- `.node-version`
- `.nvmrc`

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Local server

```bash
npm run start
```

### What a successful build does

- clears `_site/` first so stale pages do not linger in output or search
- generates the site in `_site/`
- compiles the CSS
- generates `feed.xml`
- builds the Pagefind search index

## 6. Cloudflare Pages Operations

### Production settings

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `_site`
- Root directory: blank
- Environment variable: `NODE_VERSION=22.16.0`

### Normal deployment behavior

Any push to `main` should trigger a Cloudflare Pages build and production deploy.

### What to do after each major deploy

Check these URLs:

- `/`
- `/about/`
- `/archives/`
- `/search/`
- `/staff/`
- latest article URL
- `/feed.xml`
- `/admin/`

### If deployment fails

1. Open Cloudflare Pages build logs.
2. Identify whether the error is:
   - content syntax
   - template issue
   - dependency/build problem
   - auth/config issue
3. Fix forward with a new commit if possible.
4. If the break is severe, roll back to the previous good deploy in Cloudflare Pages and then repair Git history separately.

## 7. Publishing Model

### Content types in use

#### Authors

Stored in:

- `src/content/authors/`

Fields:

- `name`
- `role`
- `short_bio`
- `bio`
- `email`
- `headshot`
- `bluesky`
- `twitter`

#### Articles

Stored in:

- `src/content/articles/`

Fields:

- `kicker`
- `title`
- `description`
- `author`
- `date`
- `tags`
- `featured_image`
- `body`

### Important publishing rules

- Every article should have a real `author` key that matches an existing author profile.
- Keep tag names consistent. A typo creates a new desk page.
- Always write a strong `description`; it is used across the homepage, metadata, and feed output.
- Use `kicker` for editorial framing, not random decoration.
- Treat `featured_image` as optional but intentional.

## 8. Day-To-Day Editorial Workflow

### Daily publishing checklist

1. Log in to `/admin/`.
2. Confirm the author profile exists.
3. Open `Content Desk`.
4. Create or update the article.
5. Fill in:
   - kicker
   - headline
   - lede
   - author
   - publication date
   - editorial tags
   - featured image if needed
   - full body
6. Save the article body and metadata.
7. Open `Proof Desk`.
8. Paste a GitHub session token if prompted.
9. Open the same article in `Proof Desk`.
10. Build or revise the proof:
   - issue
   - axioms
   - linked source documents or `No source needed`
   - inferences
   - conclusion
11. Save the proof.
12. Publish.
13. Wait for Cloudflare deploy to finish.
14. Verify the article on the live site.
15. Confirm it appears in:
   - homepage
   - desk page
   - archive
   - search
   - RSS feed
   - source-document links inside the proof

### After every publish

Sanity-check:

- title and lede look correct
- byline resolves correctly
- tags point to the right desk pages
- headings render cleanly
- dark mode still looks acceptable
- article reading tools still appear
- search can find the story
- every proof citation resolves to a real source-document page

### If there are multiple writers

Recommended operating rules:

- each writer gets a GitHub account
- each writer gets collaborator access only if they should publish
- the author profile should be created before first publication
- establish one canonical tag list and stick to it
- require a quick QA pass before publishing sensitive stories

## 9. Staff And Access Management

### GitHub access

GitHub repo access is the real source of editorial authority in this stack.

Anyone who can write to the repository can ultimately publish.

Recommended roles:

- owner: full repo, Cloudflare, domain, and auth access
- editor/maintainer: repo write access, CMS access
- contributor: only if truly needed

### What to document privately outside this repo

Maintain a secure private record of:

- GitHub owner account recovery information
- Cloudflare owner account recovery information
- domain registrar access
- email provider access
- Buttondown access if used
- OAuth client ID and client secret
- Cloudflare Worker environment variables

Do not commit secrets into this repository.

## 10. Search, RSS, And Discovery

### Search

Search is powered by Pagefind.

Operational meaning:

- there is no external search service to maintain
- every successful build regenerates the search index
- if search is stale, the build likely failed or never ran

### RSS

The feed is generated automatically and includes full article content.

Operational meaning:

- RSS is suitable for syndication and newsletter ingestion
- the `description` field is important
- broken article HTML can degrade feed quality

### Taxonomy

Desk pages are generated automatically from article tags.

Operational meaning:

- tags are a publishing control surface
- inconsistent capitalization or spelling creates taxonomy mess

Recommended canonical desk names should be decided early and documented.

## 11. Images And Media

### Current state

- featured images are supported
- image optimization tooling is present
- fully automatic transform of arbitrary inline Markdown images is not yet finished

### Current editorial recommendation

- use featured images deliberately
- keep inline images modest until the automated inline image pipeline is completed
- test articles with images on desktop and mobile after publish

## 12. Weekly And Monthly Maintenance

### Weekly

- review recent publishes for taxonomy consistency
- test `/search/`
- check `/feed.xml`
- verify contact email is monitored
- confirm Cloudflare builds are succeeding

### Monthly

- audit GitHub collaborators
- audit Cloudflare access
- review placeholder text still remaining on the site
- make sure author bios and roles are current
- confirm newsletter delivery if Buttondown is active

### Quarterly

- update dependencies
- run a full build locally
- test the CMS login flow
- review operational docs and access ownership

## 13. Troubleshooting

### Problem: CMS opens but login does not work

Likely causes:

- GitHub OAuth app not configured correctly
- Cloudflare Worker auth helper not deployed
- `base_url` missing or wrong in `src/admin/config.yml`
- callback URL mismatch

### Problem: Article published but not visible on the site

Likely causes:

- Cloudflare build failed
- article front matter is invalid
- author reference is wrong
- article date or permalink issue
- proof is missing required fields
- proof references a source document record that does not exist

Check:

- GitHub commit landed on `main`
- Cloudflare build logs
- resulting live article URL

### Problem: Search does not show new article

Likely causes:

- deploy failed
- build did not complete Pagefind indexing
- article page was not generated as expected

### Problem: Desk page looks wrong

Likely causes:

- inconsistent tag values
- accidental new taxonomy value from typo

Fix:

- normalize the article tags
- rebuild/deploy

### Problem: Feed looks incomplete

Likely causes:

- missing or weak `description`
- malformed article body markup
- image/link path issues in article content

## 14. Rollback And Recovery

### Fastest rollback

Use Cloudflare Pages rollback to restore the previous good deployment.

### Git recovery

If a bad change reached `main`, preferred recovery is:

1. identify the bad commit
2. revert the commit
3. push the revert

Avoid destructive Git history rewrites unless absolutely necessary.

### Worst-case ownership recovery

The minimum systems you must be able to recover are:

- GitHub
- Cloudflare
- domain registrar
- email

If you lose control of any one of those, operational continuity gets harder.

## 15. Recommended Editorial Standards

These are not enforced by code, but they should be treated as house rules.

- every article gets a real lede
- every article gets a clear byline
- every desk tag must come from a controlled list
- avoid publishing without post-publish QA
- treat homepage placement as editorial, not automatic convenience
- do not let sample content linger in production

## 16. Recommended Next Technical Improvements

The most valuable next implementation tasks are:

1. finish Sveltia auth with Cloudflare Worker + GitHub OAuth
2. add automatic inline Markdown image optimization
3. optionally add Buttondown and test the email pipeline
4. optionally add comments via Utterances
5. optionally add privacy-first analytics

## 17. Quick Command Reference

Install dependencies:

```bash
npm install
```

Run a local dev server:

```bash
npm run start
```

Run a production build:

```bash
npm run build
```

Check repo state:

```bash
git status
```

Push changes:

```bash
git push origin main
```

## 18. Handoff Notes For Future Maintainers

If you are inheriting this project:

- start with this manual
- then read `README.md`
- then inspect:
  - `eleventy.config.js`
  - `src/admin/config.yml`
  - `src/_data/site.json`
  - `src/content/`
- confirm Cloudflare Pages is still connected to `main`
- confirm CMS auth is still functioning
- confirm the contact email actually reaches a monitored inbox

The platform is intentionally simple. Most operational problems will come from access, workflow, or third-party configuration, not from the codebase itself.
