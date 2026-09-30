# HateBookkeeping

Internal finance OS for Axilogy and Naton Lab. Quotations, invoices, receipts, expense approvals, reimbursements, funds, and shareholder equity — plus an MCP surface for agents.

The API runs on Coolify. The web app is a static build on GitHub Pages (`hbk.naton.io`). Sign-in is Authentik-only.

## Stack

- **Web:** React 19, Vite, Tailwind 4 (`packages/web`)
- **API:** Express, MongoDB, MCP (`packages/server`)
- **Shared:** types and money helpers (`packages/shared`)

## Run locally

```bash
cp .env.example .env
# fill OIDC_*, SESSION_SECRET, MONGODB_URI — see docs/SETUP.md

npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000 (`GET /api/health`)

## Auth

Web login is Authentik (authorization-code + PKCE). The API stores PKCE in Mongo, Authentik returns to `{PUBLIC_URL}/api/auth/callback`, then the SPA exchanges a one-time ticket for a `hbk_web_` bearer token.

MCP and agents use long-lived `hbk_…` API tokens from **Endpoint** in the app. Send `Authorization: Bearer hbk_…` to `{PUBLIC_URL}/api/mcp`.

Existing users are linked on first Authentik login by **email**.

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md). Coolify builds the root `Dockerfile`. GitHub Pages builds `packages/web`.

## Layout

```
packages/shared   @hbk/shared
packages/server   @hbk/server   Express API + MCP
packages/web      @hbk/web      SPA
```
