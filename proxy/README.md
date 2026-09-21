# ERETHEUM Web Viewer Worker

This directory contains the Cloudflare Worker backend used by ERETHEUM's in-site web viewer.

## Deploy

Install Node.js and Wrangler, then from this directory run:

```bash
npm install -D wrangler@latest
npx wrangler login
npx wrangler deploy
```

Cloudflare will give the Worker a `*.workers.dev` URL. Put that URL into **ERETHEUM → Settings → Web Viewer**.

For local development:

```bash
npx wrangler dev
```

## What it does

- Accepts public HTTP(S) URLs.
- Re-checks redirects before following them.
- Rejects local/private hostnames and non-standard ports.
- Limits responses to 6 MB.
- Only accepts GET requests.
- Does not forward user cookies or arbitrary request headers.
- Rewrites common HTML links/resources back through the Worker.

This is intentionally a small personal-use viewer backend, not a full browser or a production CDN.
