# Setting up HateBookkeeping

To just try the app, you need none of this: run `npm run dev:local` (see the README).

To run it for real, the API needs two outside services: a MongoDB database and Authentik for sign-in. You point the API at them in a `.env` file. Hosting is covered in [DEPLOY.md](./DEPLOY.md).

## 1. Create the configuration file

```bash
cp .env.example .env
openssl rand -base64 48
```

Paste the generated text into `.env` as `SESSION_SECRET`. It signs sign-in sessions; changing it later signs everyone out.

## 2. MongoDB

Set `MONGODB_URI` to your database address. The last part of the address is the database name:

```
MONGODB_URI=mongodb://localhost:27017/hatebookkeeping_v2
```

The app creates what it needs in an empty database. It does not read data from the old version of HateBookkeeping, so use a database name the old version never used.

Uploaded logos, chops, signatures and receipts are stored in the database too (up to 5 MB each), so there is no upload folder to set up or back up separately.

## 3. Addresses

| Setting | What it is |
| --- | --- |
| `PUBLIC_URL` | The address browsers use to reach the API. The Authentik redirect address is built from it. |
| `WEB_ORIGIN` | The address the web app is served from. The API accepts browser requests only from here, and sends people back here after sign-in. |

Use the exact scheme, host and port, with no trailing slash. For local development the API listens on port 3000 and the Vite dev server on port 5173 of `localhost`.

## 4. Authentik

1. In Authentik, create an OAuth2/OpenID provider of the **confidential** kind and an application for it (slug, for example, `hatebookkeeping`).
2. Copy its details into `.env`:

   ```
   OIDC_ISSUER=https://authentik.example.com/application/o/hatebookkeeping/
   OIDC_CLIENT_ID=…
   OIDC_CLIENT_SECRET=…
   ```

3. Register one redirect address in Authentik: your `PUBLIC_URL` followed by `/api/auth/callback`.
4. Make sure the provider sends the `email`, `profile` and group information (the default scopes do).

### The first admin

On an empty database nobody has a role yet. Set `OIDC_ADMIN_GROUP` to the name of an Authentik group (the default is `hbk-admins`) and put yourself in that group. Members of the group become admins when they sign in.

Everyone else who signs in for the first time starts as **staff**, which means they can only enter their own claims. An admin changes roles on the Users page.

Leaving the Authentik group later does not take the admin role away. Another admin does that on the Users page. The app will not let the last admin remove their own admin role.

## 5. Email (optional)

Set `EMAIL_API_URL` and `EMAIL_API_KEY` to send approval requests and recurring reminders. Without them the app works the same, and each item's history says that the email was not sent.

Recurring reminders go out once a day at 08:00 Hong Kong time, to admins and bookkeepers.

## 6. Start it

```bash
npm install
npm run dev
```

The API reports its health at `/api/health` on port 3000. Open the address Vite prints and sign in.

If a setting is missing or wrong, the API stops at start-up and names the setting.

## 7. First things to fill in

Sign in as an admin and open **Settings**:

1. **Company**: name, address, the short code used in document numbers (for example `AX`), bank details for invoices, standard quote terms, and the logo, chop and signature images (PNG or JPEG).
2. **Document numbers**: if you are carrying on from earlier paperwork, set the next quote, invoice and receipt numbers. They can be raised, never lowered.
3. **Approvers**: choose who approves, and how many approvals are needed. Until this is done nothing can be submitted for approval. Because nobody approves their own item, choose at least two people.
4. **Categories**: rename, add or switch off income and expense categories. "Sales" and "Salary" are used by the app itself and stay on.

Then add clients, payees and staff as you need them.
