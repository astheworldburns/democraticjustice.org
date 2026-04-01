# Buttondown Workflow

This is the local workflow for turning a published Democratic Justice article into a Buttondown draft.

## What this does

The site stays responsible for publishing. Buttondown stays responsible for email delivery.

The local draft command does one job: it takes the newest public story from the built RSS feed and creates a draft email in Buttondown. It does not send anything.

## Do I need to use the terminal?

Short answer: **no, not if you do not want to**.

There are two valid workflows:

1. **No-terminal workflow (Buttondown-only)**  
   Use Buttondown's own RSS automation/features to pull from `https://democraticjustice.org/feed.xml` and draft/send from there.

2. **Terminal-assisted workflow (this script)**  
   Use `npm run newsletter:draft` to create a preformatted draft from the latest feed item, then review/send in Buttondown.

If you do not use a terminal day-to-day, pick workflow #1. The script in this file is optional tooling for operators who want more control over draft formatting and duplicate checks.

### If you use Codex + GitHub web

That is also a valid operating model.

- You can publish stories via GitHub web/Codex as usual.
- Then either:
  - run no-terminal Buttondown RSS automation (workflow #1), or
  - ask Codex to run the draft command/check command for you and paste back results.

You do not need to personally open a terminal for this workflow to work.

## One-time setup

Create a Buttondown API key in your own account. Do not paste it into chat and do not commit it to git.

In Buttondown:

1. Open `API`.
2. Open `Keys`.
3. Create a new key.
4. Give it a label such as `Democratic Justice draft tool`.
5. Keep permissions narrow. The draft tool only needs email write access.

Store the key on your machine in one of these two ways:

### Option A: local env file

Copy `.env.local.example` to `.env.local` and replace the placeholder value.

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` so it reads:

```bash
BUTTONDOWN_API_KEY=your_real_key_here
```

`.env.local` is ignored by git.

### Option B: temporary shell variable

Set the key only for your current shell session:

```bash
export BUTTONDOWN_API_KEY=your_real_key_here
```

## Per-story workflow

### 1. Publish the article

Update the article, build the site, and push it live the way you normally do.

```bash
npm run build
```

The draft tool reads from `_site/feed.xml`, so the build step must happen first.

### 2. Check the live story

Open the live site and review the article on the devices you care about. This is the pause point you wanted before email goes out.

### 3. Create the Buttondown draft

Run:

```bash
npm run newsletter:draft
```

What the command does:

- reads the newest public item from `_site/feed.xml`
- uses the article title for the subject line
- uses the article description as the deck
- pulls the opening third of the article from the local source file
- creates a Buttondown draft with a story-first body
- updates the matching draft for that article if one already exists
- creates a second draft only if you pass `--force`

The draft body is built like a real newsletter:

- deck
- byline and date
- the opening third of the story
- a `Continue reading` button

No proof card leads the email.

### 4. Open Buttondown and review the draft

In Buttondown:

1. Open `Emails`.
2. Find the new draft.
3. Review the subject and body.
4. Send a preview to yourself.

### 5. Schedule or send

Once the preview looks right:

1. Choose the send time in Buttondown.
2. Schedule it.

That keeps the final timing decision in your hands.

## Useful command options

### Dry run

Use this if you want to see the generated subject and body without creating a draft:

```bash
npm run newsletter:draft -- --dry-run
```

### Connectivity check

Use this when Buttondown appears empty or stale and you want to verify that your API key, feed, and draft lookup are aligned:

```bash
npm run newsletter:draft -- --check
```

This prints:

- how many items were found in `_site/feed.xml`
- how many Buttondown drafts were returned for the current API key
- whether the latest feed article already has a matching draft
- a short list of recent drafts visible to that key

### Force a second draft

The tool normally prevents duplicates for the same article. If you really want another draft for the same story:

```bash
npm run newsletter:draft -- --force
```

## What to expect in Buttondown

The draft tool creates a draft with:

- `status: draft`
- `email_type: public`
- `template: classic`
- the article URL as the canonical URL

It does not send immediately.

## Troubleshooting

### Missing API key

If you see a missing `BUTTONDOWN_API_KEY` error, either:

- create `.env.local`, or
- export the key in your shell

### Missing feed

If the tool says `_site/feed.xml` is missing, run:

```bash
npm run build
```

### Existing draft already found

If the newest article already has a matching Buttondown draft, the tool updates that draft in place so the latest source text is reflected. Use `--force` only if you intentionally want a second draft for the same article.

### Buttondown is not getting new data

If Buttondown (or any RSS reader) is still showing old content, check these in order:

1. **Rebuild locally** so `_site/feed.xml` is regenerated:

   ```bash
   npm run build
   ```

2. **Confirm the newest item is actually in the built feed**:

   ```bash
   sed -n '1,220p' _site/feed.xml
   ```

3. **Deploy the updated site**, then verify the live feed URL (`https://democraticjustice.org/feed.xml`) shows the new item.
4. **Wait for feed polling/cache refresh** in Buttondown. Feed readers do not always pull instantly.

If the local feed is fresh but Buttondown is not, the issue is usually polling delay or caching on the feed consumer side, not API key setup.
