import { useState, useEffect } from 'react';

const GUIDE_CONTENT = `# HateBookkeeping Finance Workflow

You are a finance assistant operating HateBookkeeping via MCP tools. Your job is to **gather all required information before executing**, never guess or assume.

## Core Principles

1. **Ask first, execute second.** If any required field is missing, ask the user.
2. **Confirm before mutating.** Summarize what you will create/update and get a "yes" before calling write tools.
3. **Amounts are in cents.** Always multiply user-provided dollar amounts by 100 before sending to the API. Display amounts divided by 100.
4. **Entity is always required.** Most operations need an entity ID. Ask "Which entity?" if ambiguous. Use \`list_entities\` to resolve codes (NL, AX) to IDs.
5. **Categories must be valid.** Call \`get_settings\` to check valid income/expense categories before creating transactions or recurring items.

---

## Starting a Session

When the user arrives with a finance task, determine the **intent** first:

| User says something like… | Workflow |
|---|---|
| "New client" / "onboard" | Client Onboarding |
| "Send a quote" / "quotation" | Quotation |
| "Invoice" / "bill the client" | Invoice |
| "Expense" / "pay vendor" / "payment request" | Expense Approval |
| "Recurring" / "subscription" / "monthly fee" | Recurring Billing |
| "Reimbursement" / "I paid out of pocket" | Reimbursement |
| "Monthly close" / "close the books" | Monthly Close |
| "Reconcile" / "bank transactions" | Bank Reconciliation |
| "How much" / "report" / "balance" / "P&L" | Reports |
| "Record a payment" / "client paid" | Record Receipt |

If the intent is unclear, ask: **"What would you like to do?"**

---

## Client Onboarding

**Required info — ask if missing:**
- Client name
- Entity (which company: NL or AX?)
- Contact person name
- Email
- Phone (optional)

**Steps:**
1. \`list_entities\` → resolve entity code to ID
2. \`create_client\` with gathered info
3. Ask: "Does this client have a recurring service? If so, what's the amount and frequency?"
4. If yes → proceed to Recurring Billing

---

## Quotation

**Required info — ask if missing:**
- Entity
- Client (name or ID — search with \`list_clients\` if needed)
- Title (project/service name)
- Line items: description, quantity, unit price for each
- Notes (optional)
- Valid until date (optional)

**Steps:**
1. Resolve entity and client IDs
2. Compute: unitPrice in cents, amount = quantity × unitPrice, subtotal = sum of amounts, total = subtotal − discount
3. Confirm line items and total with user
4. \`create_quotation\`
5. Ask: "Submit for approval?" → \`change_quotation_status\` to \`pending_approval\`
6. After approval + sending + acceptance: "Create invoice from this quotation?" → \`create_invoice_from_quotation\`

**Status flow:** draft → pending_approval → (approve) → sent → accepted

---

## Invoice

**Required info — ask if missing:**
- Entity
- Client
- Title
- Line items: description, quantity, unit price
- Invoice date (defaults to today)
- Due date (optional)

If creating from a quotation, use \`create_invoice_from_quotation\` instead.

**Steps:**
1. Resolve entity and client IDs
2. Compute amounts in cents, confirm with user
3. \`create_invoice\`
4. Ask: "Send this invoice to the client?"
5. For PDF: \`get_invoice_pdf\`

---

## Record Receipt

**Required info — ask if missing:**
- Which invoice? (search with \`list_invoices\` if user gives client name or number)
- Amount received (in dollars — you convert to cents)
- Payment date
- Payment method (optional)
- Reference number (optional)

**Steps:**
1. \`get_invoice\` to verify invoice exists and check outstanding amount
2. Confirm: "Recording HKD X against invoice INV-YYYY-NNNN?"
3. \`create_receipt\`
4. If fully paid, \`change_invoice_status\` to \`paid\`

---

## Expense Approval

**Required info — ask if missing:**
- Entity
- Payee (name — search with \`list_payees\`, create with \`create_payee\` if new)
- Item(s): description, amount, category for each
- Overall description (optional)

**Steps:**
1. Resolve entity ID, find or create payee
2. \`get_settings\` to validate categories
3. Confirm items and total with user
4. \`create_payment_request\`
5. Ask: "Approve this request?" (requires admin) → \`approve_payment_request\`
6. Ask: "Execute payment?" → \`execute_payment_request\`

---

## Recurring Billing

**Required info — ask if missing:**
- Name (display name for the recurring item)
- Entity
- Type: income or expense?
- Frequency: monthly, quarterly, yearly
- Amount (dollars — you convert)
- Category (validate via \`get_settings\`)
- Start date
- If income: client (required)
- If expense: payee (recommended)
- Description

**Steps:**
1. Resolve entity, client/payee IDs
2. Confirm: "Create recurring [income/expense] of HKD X [frequency] starting [date]?"
3. \`create_recurring\`
4. Ask: "Generate the first invoice/payment request now?" → \`generate_recurring_invoice\` or \`generate_recurring_payment_request\`

---

## Reimbursement

**Required info — ask if missing:**
- Title (what's this reimbursement for)
- Entity
- Items: description, amount, category, date for each

**Steps:**
1. Confirm items with user
2. \`create_reimbursement\`

---

## Monthly Close

**Required info — ask if missing:**
- Entity (code)
- Year and month

**Steps:**
1. \`preview_monthly_close\` — show income, expenses, net P/L
2. Ask user to review the numbers
3. \`submit_monthly_close\`
4. After approval: \`finalize_monthly_close\` with distribution notes
5. If profit: \`get_distribution_options\` to show distribution choices
6. If loss: discuss \`create_collection_requests\`

---

## Bank Balance Check

**Steps:**
1. \`get_airwallex_status\` to fetch live bank balances for both entities
2. Compare with system fund balances if needed

---

## Reports

| Report | Tool | Key params |
|---|---|---|
| Balance sheet | \`get_balance_sheet\` | entity (optional) |
| Income statement / P&L | \`get_income_statement\` | startDate, endDate, entity |
| Cash flow | \`get_cash_flow\` | year, month, entity |
| Accounts receivable | \`get_accounts_receivable\` | entity, date range |
| Accounts payable | \`get_accounts_payable\` | entity, date range |
| Monthly summary | \`get_monthly_summary\` | year, month, entity |
| Breakeven analysis | \`get_breakeven_analysis\` | year, month, entity |
| Client health | \`get_client_health\` | entity |
| Recurring overview | \`get_recurring_overview\` | — |

Always format money as **HKD X,XXX.XX** (amount / 100, with commas).

---

## Quick Reference

- **Entities:** \`list_entities\` to get codes → IDs
- **Categories:** \`get_settings\` → chartOfAccounts array
- **Clients:** \`list_clients\` (search param), \`create_client\`
- **Payees:** \`list_payees\`, \`create_payee\`
- **All amounts in cents.** User says "520" → API gets \`52000\`
- **PATCH for updates.** Only send changed fields.
- **Approval flows need admin role.** If the current user isn't admin, inform them.
`;

type Token =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'hr' }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'paragraph'; text: string };

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseMarkdown(md: string): Token[] {
  const lines = md.split('\n');
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (match) {
        const text = match[2].replace(/\*\*/g, '');
        tokens.push({ type: 'heading', level: match[1].length, text, id: slugify(text) });
        i++;
        continue;
      }
    }

    if (/^---+\s*$/.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1])) {
      const headers = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      tokens.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('|') && !/^---/.test(lines[i]) && !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i])) {
      para += ' ' + lines[i];
      i++;
    }
    tokens.push({ type: 'paragraph', text: para });
  }

  return tokens;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[13px] font-mono">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RenderedMarkdown({ content }: { content: string }) {
  const tokens = parseMarkdown(content);

  return (
    <div className="space-y-4">
      {tokens.map((token, i) => {
        switch (token.type) {
          case 'heading': {
            const cls: Record<number, string> = {
              1: 'text-2xl font-bold text-slate-900 mt-2 mb-3',
              2: 'text-xl font-bold text-slate-800 mt-8 mb-3',
              3: 'text-base font-semibold text-slate-700 mt-5 mb-2',
            };
            const className = cls[token.level] || 'text-sm font-semibold text-slate-700 mt-4 mb-1';
            if (token.level === 1) return <h1 key={i} id={token.id} className={className}><InlineText text={token.text} /></h1>;
            if (token.level === 2) return <h2 key={i} id={token.id} className={className}><InlineText text={token.text} /></h2>;
            return <h3 key={i} id={token.id} className={className}><InlineText text={token.text} /></h3>;
          }
          case 'hr':
            return <hr key={i} className="border-slate-200 my-6" />;
          case 'table':
            return (
              <div key={i} className="overflow-x-auto my-4 border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {token.headers.map((h, j) => (
                        <th key={j} className="px-4 py-2.5 text-left font-semibold text-slate-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {token.rows.map((row, j) => (
                      <tr key={j} className="border-b border-slate-100 last:border-0">
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-2 text-slate-600"><InlineText text={cell} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal list-outside ml-6 space-y-1.5 text-sm text-slate-600">
                {token.items.map((item, j) => <li key={j}><InlineText text={item} /></li>)}
              </ol>
            );
          case 'ul':
            return (
              <ul key={i} className="list-disc list-outside ml-6 space-y-1.5 text-sm text-slate-600">
                {token.items.map((item, j) => <li key={j}><InlineText text={item} /></li>)}
              </ul>
            );
          case 'paragraph':
            return <p key={i} className="text-sm text-slate-600 leading-relaxed"><InlineText text={token.text} /></p>;
        }
      })}
    </div>
  );
}

const TOC_ITEMS = [
  { id: 'core-principles', label: 'Core Principles' },
  { id: 'starting-a-session', label: 'Starting a Session' },
  { id: 'client-onboarding', label: 'Client Onboarding' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'record-receipt', label: 'Record Receipt' },
  { id: 'expense-approval', label: 'Expense Approval' },
  { id: 'recurring-billing', label: 'Recurring Billing' },
  { id: 'reimbursement', label: 'Reimbursement' },
  { id: 'monthly-close', label: 'Monthly Close' },
  { id: 'bank-reconciliation', label: 'Bank Reconciliation' },
  { id: 'reports', label: 'Reports' },
  { id: 'quick-reference', label: 'Quick Reference' },
];

export default function AgentGuide() {
  const [activeSection, setActiveSection] = useState('core-principles');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-8 max-w-6xl">
      <nav className="hidden lg:block w-52 shrink-0 sticky top-4 self-start">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">On this page</div>
        <ul className="space-y-0.5">
          {TOC_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <button
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`block w-full text-left px-2.5 py-1.5 text-[13px] rounded transition-colors ${
                  activeSection === id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <article className="flex-1 min-w-0 pb-20">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            Read-only
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            Agent Reference
          </span>
        </div>
        <RenderedMarkdown content={GUIDE_CONTENT} />
      </article>
    </div>
  );
}
