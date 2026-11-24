# HateBookkeeping

A simple bookkeeping app for Axilogy and Naton Lab. It keeps quotes, invoices, expenses, staff claims and salary, and shows the profit or loss for each month.

## What it does

| Area | What you can do |
| --- | --- |
| Clients | Keep the people and companies you sell to. |
| Quotes | Write a quote, get it approved, send it, record whether it was accepted, and turn it into an invoice once. PDF with logo, chop and signature. |
| Invoices | Issue an invoice, record each payment against it, and print a receipt for each payment. The invoice status follows the payments. |
| Expenses | Enter a bill, get it approved, then mark it paid. |
| Claims | Staff enter what they paid themselves, with a receipt on every line. Approved and paid like an expense. Staff see only their own. |
| Salary | Keep a staff list with monthly salaries and run salary once a month. Each run is approved and paid like an expense. |
| Recurring | Invoices and bills that come round on a schedule. The office is reminded by email and creates each draft with one click. |
| Other income | Money received that is not from an invoice, such as bank interest. |
| Profit & loss | Income and expenses by category for a month, and a month-by-month view of a year. Every figure opens the items behind it. |
| Dashboard | This month's figures, unpaid invoices, and what is waiting for approval or payment. |
| Users and settings | Roles, company details and branding, categories, approvers, and starting document numbers. |

It does not do shareholders or monthly close, bank or fund balances, transfers, bank feeds, or API tokens for other tools.

## How the P&L is counted

The P&L page shows two columns side by side:

- **Cash in / out** counts money on the day it moved: invoice payments on the day received, and expenses, claims and salary on the day they were paid.
- **Billed / committed** counts invoices on their invoice date (drafts and cancelled invoices are left out), and expenses, claims and salary once approved, on the date of the bill, the receipt, or the last day of the salary month.

Other income counts on the day received in both columns. Voided payments and reversed expenses count in neither. Months follow Hong Kong time, and all amounts are Hong Kong dollars.

Nothing is stored for the P&L. Each figure is added up from the invoices, payments and expenses themselves, so a total and the list behind it always agree.

## Approval

Quotes, expenses, claims and salary runs all need approval before the next step (sending a quote, paying the others).

- An admin chooses the approvers and how many approvals are needed, in Settings.
- Nobody approves an item they wrote, edited or submitted, or a claim that pays them.
- Changing an item after it was submitted clears its approvals.
- A paid item cannot be changed. An admin can reverse it, with a reason; it stays on file and leaves the P&L.

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, including users, settings, voiding a payment and reversing a paid item. |
| Bookkeeper | Quotes, invoices, expenses, claims, salary, recurring items and the P&L. No users or settings. |
| Staff | Their own claims only. |

The full table is in `packages/shared/src/permissions.ts`. The server checks it on every request.

## Try it on your own computer

You need Node 22. Nothing else: this starts the app with a temporary database, a stand-in sign-in page with four example people, and emails printed to the terminal.

```bash
npm install
npm run dev:local
```

Then open the address Vite prints. Everything is erased when you stop it.

To run against a real MongoDB and Authentik instead, see [docs/SETUP.md](docs/SETUP.md).

## Checks

```bash
npm run check    # types, lint, all tests, and both builds
npm test         # tests only
```

The server tests run against an in-memory MongoDB and a stand-in sign-in provider, so they need no outside services. The same checks run on every pull request (`.github/workflows/ci.yml`).

## Where things are

```
packages/shared      Rules used by both sides: money, dates, permissions, input checks, totals
packages/server      The API (Express, MongoDB)
  src/platform       Config, sign-in checks, errors, shared helpers
  src/modules        One folder per area: quotes, invoices, expenses, salary, recurring, reports…
  src/integrations   Authentik sign-in, email, PDFs
  test               Tests, and the local stand-in server
packages/web         The web app (React, Vite, Tailwind)
packages/ui          Shared interface parts
packages/ui-theme    Colours and type
```

## Deploying

The API runs on Coolify from the root `Dockerfile`. The web app is a static build published to GitHub Pages whenever `main` changes. See [docs/DEPLOY.md](docs/DEPLOY.md), which also has the steps for switching from the old app to this one.
