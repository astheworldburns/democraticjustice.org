# Buttondown Workflow

This is the local workflow for turning a published Democratic Justice article into a Buttondown draft.

## What this does

The site stays responsible for publishing. Buttondown stays responsible for email delivery.

The local draft command does one job: it takes the newest public story from the built RSS feed and creates a draft email in Buttondown. It does not send anything.

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
- refuses to create a duplicate draft for the same article unless you force it

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

If the tool says a matching draft already exists, that is working as intended. Open Buttondown and edit the existing draft instead of creating another one.
