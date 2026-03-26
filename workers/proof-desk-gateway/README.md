# Proof Desk Gateway

This Cloudflare Worker removes manual GitHub tokens from the Proof Desk.

It handles:

1. GitHub sign-in for the custom Proof Desk
2. Session-backed API routes for article proof data and inline source creation
3. Optional `/auth` + `/callback` routes that can be used as a Sveltia-compatible GitHub auth helper later

## Recommended deployment model

Use this Worker for the **Proof Desk first**.

That means:

- leave `backend.base_url` in [/src/admin/config.yml](/Users/sethsturm/Documents/New%20project/src/admin/config.yml) alone for now
- deploy this Worker on its own HTTPS subdomain, ideally `https://auth.democraticjustice.org`
- add `proof_api_base_url: https://auth.democraticjustice.org` to [/src/admin/config.yml](/Users/sethsturm/Documents/New%20project/src/admin/config.yml)

This is the least risky path because it does not force a same-day migration of the existing Content Desk auth flow.

## What writers need

Each writer still needs a GitHub account with write access to:

- `astheworldburns/democraticjustice.org`

The Proof Desk Worker uses that writer's GitHub OAuth grant server-side. Writers do **not** need to create personal access tokens or paste tokens into the browser once this Worker is live.

## Expected routes

- `GET /proof/login`
- `GET /callback`
- `POST /proof/logout`
- `GET /api/session`
- `GET /api/proof/articles`
- `GET /api/proof/article?slug=...`
- `GET /api/proof/documents`
- `POST /api/proof/save`
- `POST /api/proof/create-document`

Current inline source upload limits:

- supported file types: PDF and common web image formats
- maximum file size: 25 MB per source file

Optional Sveltia compatibility routes also exist:

- `GET /auth`
- `GET /callback`

Treat those as scaffolding unless and until you explicitly move `backend.base_url` to this Worker and verify the Content Desk login flow.

## Required secrets

Set these as **Worker secrets**, not plain vars:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Required KV binding

- `EDITOR_SESSIONS`

This KV namespace stores short-lived Proof Desk sessions.

## Required vars

These live in [wrangler.toml](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway/wrangler.toml):

- `GITHUB_HOSTNAME`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_BRANCH`
- `ARTICLE_CONTENT_PATH`
- `DOCUMENT_CONTENT_PATH`
- `DOCUMENT_ASSET_PATH`
- `ALLOWED_ORIGINS`

Optional:

- `GITHUB_ALLOWED_USERS`
- `GITHUB_ALLOWED_ORG`
- `ALLOWED_DOMAINS`

## Owner setup checklist

### 1. Create a GitHub OAuth App

In GitHub:

1. Go to `Settings -> Developer settings -> OAuth Apps -> New OAuth App`
2. Set:
   - `Application name`: `Democratic Justice Proof Desk`
   - `Homepage URL`: `https://democraticjustice.org/admin/proof/`
   - `Authorization callback URL`: `https://auth.democraticjustice.org/callback`
3. Save the app.
4. Copy the client ID.
5. Generate a client secret and store it somewhere safe.

For local testing, you can add an extra callback later if needed, but production is the one that matters first.

### 2. Create the Cloudflare KV namespace

Inside [workers/proof-desk-gateway](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway):

```bash
npx wrangler kv namespace create EDITOR_SESSIONS
```

Copy the returned namespace ID into [wrangler.toml](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway/wrangler.toml) where it currently says `REPLACE_WITH_KV_NAMESPACE_ID`.

### 3. Decide who is allowed in

Choose one of these:

- set `GITHUB_ALLOWED_ORG` to a GitHub organization name
- set `GITHUB_ALLOWED_USERS` to a comma-separated username list
- set neither if you truly want any GitHub user with repo access to be able to sign in

For a newsroom, explicit user or org restrictions are recommended.

### 4. Set Worker secrets

Inside [workers/proof-desk-gateway](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway):

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Paste the values from the GitHub OAuth App when prompted.

### 5. Set the allowed frontend origins

In [wrangler.toml](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway/wrangler.toml), make sure `ALLOWED_ORIGINS` includes every real admin origin that will host the Proof Desk.

Current defaults:

- `https://democraticjustice.org`
- `http://localhost:8080`

If you later use a preview domain or alternate admin host, add it there too.

### 6. Deploy the Worker on a real HTTPS domain

Recommended custom domain:

- `auth.democraticjustice.org`

Deploy from [workers/proof-desk-gateway](/Users/sethsturm/Documents/New%20project/workers/proof-desk-gateway):

```bash
npm install
npx wrangler deploy
```

Then attach the Worker to the custom domain in Cloudflare so `https://auth.democraticjustice.org` serves this Worker.

Convenience commands also exist from the repo root:

```bash
npm run proof-gateway:install
npm run proof-gateway:deploy
```

### 7. Point the Proof Desk at the Worker

Add this to [/src/admin/config.yml](/Users/sethsturm/Documents/New%20project/src/admin/config.yml):

```yaml
proof_api_base_url: https://auth.democraticjustice.org
```

Do **not** change `backend.base_url` yet unless you are intentionally moving the Content Desk to this same Worker and have tested it.

### 8. Give writers repo access

Each writer who should save proofs or create source docs must have GitHub write access to:

- `astheworldburns/democraticjustice.org`

Without repo write access, OAuth login may succeed but proof saves and source creation will fail against GitHub.

### 9. Test the live flow

After deployment:

1. Visit `/admin/proof/`
2. Confirm the desk shows `Sign in with GitHub`
3. Sign in
4. Open an article
5. Save a proof change
6. Create a source document inline
7. Confirm the repo updates landed correctly

## Important behavior to know

- If `proof_api_base_url` is missing, the Proof Desk stays in legacy token mode.
- If `proof_api_base_url` is set but `/api/session` is unreachable, the desk falls back to legacy token mode.
- That fallback is intentional so the desk does not hard-lock during setup or outage recovery.

## Local development

Typical local split:

1. run the site locally on `http://localhost:8080`
2. keep the Worker deployed on HTTPS, or use `wrangler dev` if you are comfortable adjusting OAuth callbacks for local testing

The simplest path is to keep the Worker on a real HTTPS domain even while the site itself is local.

## Security note

This Worker keeps GitHub OAuth tokens server-side in short-lived KV-backed sessions so the Proof Desk browser no longer needs manual tokens.

That is a major improvement over browser-pasted tokens, but it still means:

- Cloudflare account access must be protected
- Worker secrets must be protected
- KV access should be treated as sensitive

If you ever want to remove writer-bound GitHub tokens entirely, the next step after this is a GitHub App or installation-token model. For now, this Worker is the practical newsroom-safe version.
