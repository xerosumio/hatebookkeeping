# Deploying HateBookkeeping

The app is two parts on two sites:

- The **API** runs on Coolify, built from the `Dockerfile` at the root of this repository.
- The **web app** is a static build published to GitHub Pages at `hbk.naton.io` by `.github/workflows/pages.yml`, every time `main` changes.

Because they are different sites, each must be told the other's address.

| Setting | Where it is set | Value |
| --- | --- | --- |
| `PUBLIC_URL` | Coolify | The API's HTTPS address |
| `WEB_ORIGIN` | Coolify | `https://hbk.naton.io` |
| `VITE_API_URL` | GitHub repository variable | Same as `PUBLIC_URL` |

Use exact addresses with no trailing slash. A wrong one shows up as a sign-in that fails or a page that cannot load its data.

## Switching from the old app to this one

This version starts from an empty database. It does not read or change the old database, so the old data stays as it was and can be opened again by pointing an old build at it.

Merging to `main` publishes the new web app straight away, and the new web app does not work with the old API. So do the steps in this order, at a quiet time:

1. **Coolify: point the API at a new database.** Change `MONGODB_URI` so its database name is one the old app never used, for example `…/hatebookkeeping_v2`. Do not delete the old database.
2. **Coolify: check the sign-in settings.** `OIDC_ADMIN_GROUP` must name an Authentik group that you are in, or nobody will be an admin in the new, empty database. The other `OIDC_*` values, `SESSION_SECRET`, `PUBLIC_URL` and `WEB_ORIGIN` stay as they are.
3. **Coolify: remove what is no longer used.** The `AIRWALLEX_*` variables, `UPLOAD_DIR`, and the volume mounted at `/app/uploads` are not read any more. Removing them is tidy, not required. Keep the old upload volume's contents if you want the old receipts.
4. **Merge the pull request into `main`.** GitHub Pages rebuilds the web app.
5. **Coolify: redeploy the API** from `main`, and wait for the health check to pass.
6. **Sign in** at `https://hbk.naton.io`. You should arrive as an admin on an empty dashboard that asks you to add a company.
7. **Fill in Settings**: company details and images, next document numbers, approvers, categories. See the list at the end of [SETUP.md](./SETUP.md).
8. **Enter what is still open**: your clients, and each invoice that has not been fully paid, so new payments can be recorded against them. Give other people their roles on the Users page after they have signed in once.

Between steps 4 and 5 the new web app is talking to the old API and will show errors. Keeping that gap short is the reason to do the Coolify changes first.

To go back: redeploy the previous commit on Coolify with the old `MONGODB_URI`, and revert the merge on `main` so Pages republishes the old web app.

## Coolify (API)

1. Create an application from this repository. Build with the **Dockerfile at the root**. Do not use Nixpacks, and do not set the build folder to `packages/server`.
2. Health check: `GET /api/health` on port 3000.
3. No volume is needed. Uploaded files are stored in MongoDB.
4. Set the environment from `.env.example`. In production these are required:
   - `NODE_ENV=production`
   - `PUBLIC_URL`
   - `WEB_ORIGIN=https://hbk.naton.io`
   - `MONGODB_URI`
   - `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ADMIN_GROUP`
   - `SESSION_SECRET`
5. In Authentik, the redirect address is `PUBLIC_URL` followed by `/api/auth/callback`.

Mark every variable as **runtime only**, not "available at build time", so secrets are not baked into the image.

If a setting is missing or wrong the container stops at start-up and the log names the setting.

## GitHub Pages (web app)

1. Repository **Settings → Pages**: source **GitHub Actions**, custom domain `hbk.naton.io`.
2. Repository **Settings → Variables**: `VITE_API_URL` set to the API's address. The optional `VITE_SUITE_*_URL` variables fill the app switcher; leave one blank to hide that app.
3. Every push to `main` publishes. The build copies `index.html` to `404.html` so a page address still works after a refresh.

## Checking a deployment

- `GET /api/health` on the API answers `{"status":"ok"}`.
- Signing in at `https://hbk.naton.io` returns you to the page you asked for.
- Opening a quote or invoice PDF shows the logo, chop and signature.

## Backups

Everything, including uploaded images and receipts, is in the one MongoDB database. Back that up.
