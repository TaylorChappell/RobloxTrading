# GitHub Pages setup

This is a Vite application. GitHub Pages must publish the compiled `dist/` directory produced by GitHub Actions. Do not configure Pages to publish the repository root or `main` branch directly.

## Required GitHub settings

1. Open the frontend repository.
2. Go to `Settings -> Secrets and variables -> Actions -> Variables`.
3. Add `VITE_API_URL` with the public HTTPS Railway API URL, for example `https://your-api.up.railway.app`.
4. Leave `VITE_SIGNER_URL` unset unless you intentionally expose a devnet-only signer endpoint over HTTPS.
5. Go to `Settings -> Pages`.
6. Under `Build and deployment`, set `Source` to **GitHub Actions**.
7. Go to `Actions -> Deploy wallet portal to GitHub Pages` and run the workflow, or push a commit to `main`.

The workflow determines the correct Vite base automatically:

- `https://username.github.io/` -> `/`
- `https://username.github.io/repository-name/` -> `/repository-name/`

## How to tell it is deployed correctly

The production page must load compiled files such as:

`/repository-name/assets/index-xxxxx.js`

It must not request:

`/src/main.tsx`

If DevTools shows `main.tsx 404`, GitHub Pages is publishing your source repository instead of the GitHub Actions artifact. Re-check `Settings -> Pages -> Source -> GitHub Actions`.

## Backend CORS

If your Pages URL is `https://username.github.io/repository-name/`, the Railway API should include this browser origin:

```env
PORTAL_ORIGINS=http://localhost:3000,https://username.github.io
```

CORS origins do not include `/repository-name/`.
