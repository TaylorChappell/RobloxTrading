# GitHub Pages deployment

The wallet portal/admin frontend is a static Vite application and can be hosted directly on GitHub Pages. The API, indexer, database, Redis and signer are still backend services and must run somewhere else (Railway, Fly.io, AWS, etc.).

## 1. Push the repository to GitHub

The repository includes `.github/workflows/deploy.yml`. It builds the frontend and publishes `dist` to GitHub Pages whenever `main` changes.

## 2. Configure the public backend URL

In the GitHub repository, open:

`Settings -> Secrets and variables -> Actions -> Variables`

Create:

- `VITE_API_URL` (required): the public HTTPS URL of the Fastify API, for example `https://api.example.com`.
- `VITE_SIGNER_URL` (optional): only needed for the current devnet-only direct private-key import flow. Do not expose the development signer publicly for a mainnet deployment.

These are public frontend configuration values, not secrets. Never put `ADMIN_PASSWORD`, `JWT_SECRET`, `ROBLOX_SHARED_SECRET`, `SIGNER_SHARED_SECRET`, private keys, database credentials or RPC secrets into a `VITE_*` variable. Vite embeds `VITE_*` values into the browser bundle.

## 3. Enable GitHub Pages

Open:

`Settings -> Pages`

Set **Source** to **GitHub Actions**.

Then either push to `main` or run `Deploy wallet portal to GitHub Pages` manually from the Actions tab.

The Vite build uses relative asset paths, so no repository-name configuration is required. It works for both:

- `https://username.github.io/`
- `https://username.github.io/repository-name/`

The admin page uses hash routing and is available at:

`https://your-pages-url/#admin`

That avoids GitHub Pages SPA refresh/404 problems.

## 4. Allow the GitHub Pages origin in the API

The API must allow the exact Pages origin in `PORTAL_ORIGINS`.

For a project Pages URL such as:

`https://username.github.io/repository-name/`

use the browser origin only (no path):

```env
PORTAL_ORIGINS=https://username.github.io
```

For local development plus Pages:

```env
PORTAL_ORIGINS=http://localhost:3000,https://username.github.io
```

Restart/redeploy the API after changing it.

If the devnet import flow is intentionally exposed, the signer also needs the same origin:

```env
SIGNER_IMPORT_ORIGINS=https://username.github.io
```

Again, the direct signer import endpoint is not intended to be exposed as a production mainnet key-management service.

## 5. What GitHub Pages hosts

GitHub Pages hosts only:

- React wallet portal
- Phantom/Solflare connection UI
- wallet management UI
- portfolio UI
- admin/debug UI

It does **not** host:

- Fastify API
- PostgreSQL
- Redis
- Solana indexer
- signing service

Those stay on the backend host and the frontend connects to the API over HTTPS.

## Updating the site

After setup, normal updates are just:

```bash
git add .
git commit -m "Update wallet portal"
git push origin main
```

GitHub Actions rebuilds and redeploys the site automatically.
