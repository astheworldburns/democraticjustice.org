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

Status: working for the Content Desk, but still separate from the new Proof Desk gateway.

What exists now:

- `/admin/` is in the project
- `src/admin/cms/config.yml` is the Content Desk schema source
- `/admin/cms/data/config.json` is generated from that schema at build time
- content schema for authors and articles is already in place

What still needs owner action:

1. Deploy the Sveltia auth helper to Cloudflare Workers.
2. Create a GitHub OAuth App.
3. Add the Worker URL as `base_url` under the `backend:` section in both `src/admin/cms/config.yml` and `src/admin/config.yml`.
4. Invite contributors to the GitHub repo as collaborators if they need publishing access.

Without this, the CMS is not ready for non-technical multi-author use.

#### Proof Desk gateway

Status: scaffolded in-repo, but requires owner deployment.

What exists now:

- custom Proof Desk UI at `/admin/proof/`
- Cloudflare Worker scaffold in `workers/proof-desk-gateway/`
- server-side session flow for proof saves and inline source creation
- legacy token fallback while setup is incomplete

What owner action is needed:

1. Create a GitHub OAuth App for the Proof Desk Worker.
2. Create the `EDITOR_SESSIONS` KV namespace in Cloudflare.
3. Deploy the Worker on a real HTTPS domain, ideally `auth.democraticjustice.org`.
4. Set `proof_api_base_url` in `src/admin/config.yml`.
5. Ensure every writer has GitHub write access to the repo.

Primary setup guide:

- `workers/proof-desk-gateway/README.md`

### Cloudflare Worker observability config format

Use the `wrangler.toml` format in this repository.  
The JSON object form is equivalent in meaning, but this codebase stores Worker config in TOML files such as:

- `workers/admin-gateway/wrangler.toml`
- `workers/cms-gateway/wrangler.toml`
- `workers/proof-desk-gateway/wrangler.toml`
- `workers/document-preview-pipeline/wrangler.toml`

Current default policy in this project:

- enable invocation logs
- keep traces disabled unless actively debugging

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
- deploy the Proof Desk gateway Worker and point `proof_api_base_url` at it
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

### Deploying the Writer Desk gateway

The Writer Desk API runs in the separate Cloudflare Worker `proof-desk-gateway`.
The GitHub Actions workflow **Deploy Writer Desk gateway** deploys it after
relevant changes merge into `main`. It also supports **Run workflow** on `main`
for a retry. Article-only edits do not trigger a Worker deployment.

Set these two **repository secrets** at
`https://github.com/astheworldburns/democraticjustice.org/settings/secrets/actions`:

- `CLOUDFLARE_ACCOUNT_ID`: the account ID for the existing Worker.
- `CLOUDFLARE_API_TOKEN`: a Cloudflare **Edit Cloudflare Workers** API token scoped
  to that account. Use the token already created for deployment.

For each value, select **New repository secret**, enter the exact name and its
value, then select **Add secret**. These are deployment credentials for GitHub
Actions; keep them in repository secrets rather than Worker runtime variables,
source files, PR comments, or chat. No new Worker is needed.

After the secrets are saved and the workflow is merged, open the repository's
**Actions** tab, select **Deploy Writer Desk gateway**, and check the latest run.
If an earlier run failed because credentials were missing, use **Run workflow**
with branch `main` to retry after adding them.

The workflow checks history and narration behavior, bundles the Worker, and
confirms the existing Worker's deployment history before releasing. Deployment
preserves dashboard environment variables and existing secrets. The previous
deployment versions appear in the run logs for rollback. A successful run
confirms deployment; authenticated Writer Desk saving still needs verification
with a real editor session.

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
14. If you published a new source-document PDF, confirm the Cloudflare build generated its preview image.
15. Verify the article on the live site.
16. Confirm it appears in:
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

### Standards for new images

Apply these standards to new or replaced images. Existing assets can stay at their current URLs; renaming them requires updating every reference.

- Use lowercase, hyphenated filenames without spaces, such as `town-council-meeting.jpg`.
- Export or convert images to a real JPEG, PNG, WebP, or AVIF file. Changing the extension alone does not convert a HEIC/HEIF photo.
- Keep images uploaded directly to `src/assets/images/uploads/` at or below 500 KiB. Resize and compress before upload; direct Markdown images are copied without automatic optimization.
- For larger editorial figures, store the original in `src/assets/images/source/` and use the existing image shortcode to produce responsive, optimized derivatives:

  ```njk
  {% image "/assets/images/source/town-council-meeting.jpg", "Council members discussing the budget" %}
  ```

- Run `npm run build` and review `npm run audit:assets` before publishing. Fix warnings for new images; existing warnings do not need to be cleared to publish unrelated work. The global strict asset audit checks legacy files too.
- Check the published image and its alt text on desktop and mobile.

### Article audio editions

Articles can include your recorded reading in place of the old Contents box. The player uses the newsroom wordmark and article styles. It appears only when a recording is attached; articles without audio have no player or empty placeholder.

Export the recording as an MP3, up to 20 MiB. Use a descriptive, lowercase filename such as `worthington-sewer-crisis-reading.mp3`. Compressed speech recordings are preferable to large uncompressed originals.

In the Writer Desk:

1. Open the article and find **Article narration (optional)** in the Story section.
2. Choose the MP3 and click **Upload MP3**. The file selection remains available if an upload fails, so you can retry.
3. Optionally fill in **Read by**, for example `Seth Sturm`.
4. Click **Save story** to attach the recording to the article. Uploading alone does not publish the player.
5. After the site deploys, verify playback, seeking, and the narrator credit on the article.

In the Content Desk, use the article's optional **Article Narration (MP3)** and **Narrator Name** fields, then save/publish as usual. Existing podcast audio is managed separately.

To replace a recording, upload another MP3 and save. To remove the player, use **Remove audio from article** in the Writer Desk or clear the narration field in the Content Desk, then save. Removing an attachment leaves the stored MP3 in the media library so existing file links remain available.

The player offers play/pause, 15-second skips, seeking, and playback speed. It never autoplays and does not fetch the recording until the reader starts playback. Browser audio controls remain available when JavaScript is disabled. The article text serves as the written version of the recording; review both when updating a story.

For file-based editing, the optional article frontmatter is:

```yaml
audio_file: /media/narration/worthington-sewer-crisis-reading.mp3
audio_narrator: Seth Sturm
```

MP3 files live in `static/media/narration/` and are served from `/media/narration/` by the normal site build. This version uses the existing repository publishing workflow and does not require R2. The Writer Desk upload endpoint requires the updated `proof-desk-gateway` Worker to be deployed as part of releasing this feature; merging the static-site changes alone does not deploy that Worker.

Readers can resume a recording where they left off, with their chosen playback speed. Those settings stay in the browser on that device and are specific to the recording's URL. Replacing a recording with a new upload starts fresh. Playback always requires a reader action. After playback starts, a compact player appears when the full player scrolls away; readers can pause, return to the full controls, or hide it for the session. Supported browsers also receive article title, narrator, artwork, and transport controls for the phone's media screen.

### Publication dates, updates, and corrections

Keep **Publication date** as the date the original story appeared. Both publishing desks provide optional **Updated date and time**, **Update note**, and **Correction note** fields. Set the update time explicitly when revising reporting; it must be later than publication. A note requires that update time. Nothing fills these fields automatically.

The article shows its original publication date and, when valid, the updated date and time in Eastern time. Supplied notes appear near the byline as plain text. Use the update note to explain substantive additions; use the correction note to state the error and its correction. These fields describe the latest dated revision, rather than an automatically generated revision log. Preserve prior correction information when editing the note.

For file-based editing:

```yaml
updated: '2026-10-27T14:30:00-04:00'
update_note: Added the agency's response and linked its supporting records.
correction_note: Corrected the date of the council meeting.
```

Leave the fields blank when no update or correction applies. To clear an updated date, also clear its dated notes. Older clients that omit these fields retain the existing values. Writer Desk saving requires the updated `proof-desk-gateway` Worker; deploy it when releasing the reporting-history fields.

### Reading and checking sources

The homepage shows the lead investigation followed by recent reporting. Its Evidence Room highlights source records cited by that lead; the archive link still reaches the complete collection.

On an article, local source-document citations open a source drawer with the document description, provenance, and available preview. The full document record and file remain accessible from the drawer. Close it or press Escape to return to the same place in the article. External source links and ordinary new-tab gestures retain normal navigation. Without JavaScript, citations still open the original document links.

The reading order is story, Check Our Work, Sources, and then related reporting. A first-page preview is labelled as such; it is not a representation of every page in the record.

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
