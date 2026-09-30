# Deploying HateBookkeeping

The API runs on Coolify. The web app is a static build on GitHub Pages with a custom domain (`hbk.naton.io`). They are different sites, so production must set both origins explicitly.

---

## Origins

| Variable | What it is | Example |
| --- | --- | --- |
| `PUBLIC_URL` | Coolify origin. Authentik callbacks, MCP. | `https://<coolify-host>` |
| `WEB_ORIGIN` | GitHub Pages custom domain. CORS, post-login redirect. | `https://hbk.naton.io` |
| `VITE_API_URL` | Same value as `PUBLIC_URL`, baked into the Pages build. | `https://<coolify-host>` |

A trailing slash or a missing scheme will produce authorization failures that are hard to read. Use the exact origin the browser sees.

---

## Coolify (API)

1. Create an application from this repo. The [Dockerfile](../Dockerfile) at the **root** is the build. Do not use Nixpacks and do not set the build context to `packages/server` or `backend/`.
2. Health check: `GET /api/health`.
3. Mount a volume at `/app/uploads` for receipts, chops, and signatures.
4. Set the environment from `.env.example`. Required in production:
   - `NODE_ENV=production`
   - `PUBLIC_URL` — the Coolify HTTPS origin
   - `WEB_ORIGIN=https://hbk.naton.io`
   - `MONGODB_URI`
   - Authentik `OIDC_*`
   - `SESSION_SECRET`
5. In Authentik, register the redirect URI on **PUBLIC_URL**:
   ```
   https://<coolify-host>/api/auth/callback
   ```
6. Point MCP clients at `https://<coolify-host>/api/mcp` with a `hbk_…` API token.

In Coolify, mark **every** variable — especially `NODE_ENV` and the secrets — as **runtime only**, not “Available at Buildtime”. The Dockerfile already installs build tools even if `NODE_ENV=production` leaks into the build, but secrets should never be baked into image layers.

---

## GitHub Pages (web)

1. Repo **Settings → Pages**: source **GitHub Actions**, custom domain `hbk.naton.io`, wait for HTTPS.
2. Repo **Settings → Variables**: `VITE_API_URL` = the Coolify origin (`PUBLIC_URL`), no trailing slash. Optional suite switcher origins: `VITE_SUITE_NDOC_URL`, `VITE_SUITE_NDRIVE_URL`, `VITE_SUITE_KANBAN_URL`, `VITE_SUITE_ORBIT_URL`, `VITE_SUITE_HBK_URL`, `VITE_SUITE_LOOM_URL`, `VITE_SUITE_NOPS_URL`. Fastmail defaults to `https://app.fastmail.com`; override with `VITE_SUITE_FASTMAIL_URL`.
3. Push to `main` (or run **Deploy web to GitHub Pages**). The build copies `index.html` to `404.html` so deep links survive a refresh.

The SPA is served from `/` on the custom domain. Do not use a project-pages path like `username.github.io/hatebookkeeping`.

---

## Check

```bash
curl https://<coolify-host>/api/health
```

Open `https://hbk.naton.io`, sign in with Authentik, and confirm an existing user (same email) still has their role and bank details.
