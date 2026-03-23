# Democratic Justice

Investigative journalism and political accountability reporting from West Virginia.

## Stack

- Eleventy v3
- Tailwind CSS
- Sveltia CMS
- Cloudflare Pages

## Local development

```bash
npm install
npm run build
```

For a local dev server:

```bash
npm run start
```

## Cloudflare Pages

Use these settings in the Cloudflare Pages dashboard:

- Production branch: `main`
- Build command: `npx @11ty/eleventy`
- Build output directory: `_site`
- Root directory: leave blank

Recommended environment variable:

- `NODE_VERSION=22.16.0`

The repository also includes `.node-version` and `.nvmrc` pinned to `22.16.0`.

## CMS

The editorial dashboard is available at `/admin/`.

After deployment, configure a GitHub OAuth App for Sveltia CMS:

- Homepage URL: `https://democraticjustice.org`
- Authorization callback URL: `https://democraticjustice.org/admin/`

