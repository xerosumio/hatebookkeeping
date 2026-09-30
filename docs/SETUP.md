# Setting up HateBookkeeping

Depends on two external services: MongoDB and Authentik. Nothing is bundled — you point the API at them through `.env`.

Production hosting (Coolify + GitHub Pages) is in [DEPLOY.md](./DEPLOY.md).

---

## 1. Secrets

```bash
cp .env.example .env
echo "SESSION_SECRET=$(openssl rand -base64 48)"
```

Paste `SESSION_SECRET` into `.env`. It signs `hbk_web_` session tokens.

---

## 2. MongoDB

```
MONGODB_URI=mongodb://localhost:27017/hatebookkeeping
```

Atlas or a local `mongod` both work. Transactions are not required.

---

## 3. Origins

| Variable | What it is | Local example |
| --- | --- | --- |
| `PUBLIC_URL` | API origin. Authentik redirect URIs are built from this. | `http://localhost:3000` |
| `WEB_ORIGIN` | SPA origin. CORS and the post-login redirect. | `http://localhost:5173` |

Use the exact scheme + host + port the browser sees. No trailing slash.

---

## 4. Authentik / OIDC

1. Create a **confidential** OAuth2/OIDC application (slug e.g. `hatebookkeeping`).
2. Issuer is the application’s OIDC base:

```
OIDC_ISSUER=https://authentik.example.com/application/o/hatebookkeeping/
OIDC_CLIENT_ID=…
OIDC_CLIENT_SECRET=…
OIDC_SCOPES=openid profile email
```

3. Redirect URI (on **PUBLIC_URL**, not Pages):

```
http://localhost:3000/api/auth/callback
```

In production that is `https://<coolify-host>/api/auth/callback`.

4. Optional: set `OIDC_ADMIN_GROUP` to an Authentik group name. Members become `admin` on every login. Leave blank to keep roles as they are in Mongo (existing William/Andy admins stay admins).

Users must sign in with the **same email** already stored on the user document so the first login links `authentikId`.

---

## 5. Optional

- **Email:** `EMAIL_API_URL` + `EMAIL_API_KEY` for approval and recurring reminders.
- **Airwallex:** `AIRWALLEX_AX_*` and `AIRWALLEX_NT_*` for live HKD balances.

---

## Check

```bash
npm install
npm run dev
curl http://localhost:3000/api/health
```

Open http://localhost:5173 and sign in with Authentik.
