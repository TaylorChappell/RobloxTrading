# Roblox Solana Wallet Portal

Standalone React/Vite frontend for the Roblox Solana trading backend.

It contains:
- Roblox link-code login
- Phantom and Solflare wallet linking
- Five wallet-slot management
- Managed-wallet creation
- Portfolio display
- Devnet-only imported-wallet UI
- Backend admin/debug dashboard at `#admin`

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Default local environment:

```env
VITE_API_URL=http://localhost:8080
VITE_SIGNER_URL=http://localhost:8081
```

## GitHub Pages

1. Push this repository to GitHub.
2. In `Settings -> Secrets and variables -> Actions -> Variables`, create `VITE_API_URL` with the public HTTPS backend URL.
3. Optionally set `VITE_SIGNER_URL` for the devnet-only direct import flow.
4. In `Settings -> Pages`, set Source to `GitHub Actions`.
5. Push to `main`.

The included `.github/workflows/deploy.yml` builds and publishes the site automatically.

The admin UI is available at `https://your-pages-url/#admin`.

See `GITHUB_PAGES.md` for CORS and deployment details.

## Security
