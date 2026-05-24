import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer) {

  server.prompt('monthly-close', 'Walk through the monthly close process for an entity', {
    entity: z.string().describe('Entity code (e.g. "ax" or "nt")'),
    year: z.string().describe('Year (e.g. "2026")'),
    month: z.string().describe('Month number (e.g. "5")'),
  }, async ({ entity, year, month }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please execute the monthly close workflow for entity "${entity}", ${year}-${month}:

1. Call preview_monthly_close to compute the preview
2. Review the numbers — show me income, expenses, and net profit/loss
3. Call submit_monthly_close to submit for approval
4. If this is a profit month, call get_distribution_options to see how profit can be distributed
5. Walk me through each step before proceeding

Entity: ${entity}
Year: ${year}
Month: ${month}`,
      },
    }],
  }));

  server.prompt('new-client-onboarding', 'Set up a new client with recurring billing', {
    clientName: z.string().describe('Client name'),
    entity: z.string().describe('Entity code'),
    amount: z.string().describe('Monthly amount in display currency (e.g. "520")'),
    description: z.string().optional().describe('Service description'),
  }, async ({ clientName, entity, amount, description }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Onboard a new client with recurring billing:

1. First, call list_entities to find the entity ID for code "${entity}"
2. Call create_client with name="${clientName}" and the entity ID
3. Call get_settings to find a valid income category
4. Call create_recurring with:
   - name: "${clientName} Monthly Service"
   - type: "income"
   - frequency: "monthly"
   - amount: ${amount} * 100 (convert to cents!)
   - category: (from settings)
   - client: (from step 2)
   - startDate: today
   ${description ? `- description: "${description}"` : ''}
5. Optionally generate the first invoice with generate_recurring_invoice

Client: ${clientName}
Entity: ${entity}
Amount: ${amount} (display currency, multiply by 100 for API)`,
      },
    }],
  }));

  server.prompt('bank-reconciliation', 'Review and reconcile pending bank transactions', {
    entity: z.string().optional().describe('Entity code to filter by'),
  }, async ({ entity }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Review and reconcile pending bank transactions${entity ? ` for entity "${entity}"` : ''}:

1. Call trigger_airwallex_sync${entity ? ` with entity="${entity}"` : ' for each entity'} to sync latest transactions
2. Call list_pending_bank_transactions to see unmatched transactions
3. For each pending transaction:
   a. Try to match it to an existing system transaction using match_pending_transaction
   b. If no match exists, create a new transaction using create_from_pending
   c. If it's not relevant, dismiss it using dismiss_pending with a note
4. Show me a summary of what was matched, created, and dismissed`,
      },
    }],
  }));

  server.prompt('invoice-from-quotation', 'Convert an accepted quotation into invoices', {
    quotationId: z.string().describe('Quotation ID'),
  }, async ({ quotationId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Convert quotation ${quotationId} into invoice(s):

1. Call get_quotation to verify it's in "accepted" status
2. If not accepted, show me the current status and ask if I want to proceed
3. Call create_invoice_from_quotation with the quotation ID
4. Show me the created invoice(s)
5. Ask if I want to change the status to "unpaid" and send it to the client`,
      },
    }],
  }));

  server.prompt('expense-approval', 'Create and process an expense approval request', {
    entity: z.string().describe('Entity code'),
    payee: z.string().describe('Payee name or ID'),
    amount: z.string().describe('Amount in display currency'),
    category: z.string().describe('Expense category'),
    description: z.string().describe('What is this expense for'),
  }, async ({ entity, payee, amount, category, description }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Create and process an expense approval:

1. Call list_entities to find the entity ID for "${entity}"
2. Call list_payees to find the payee ID for "${payee}" (create one if needed)
3. Call create_payment_request with:
   - entity: (from step 1)
   - items: [{payee: (ID), description: "${description}", amount: ${amount} * 100, category: "${category}"}]
4. Show me the created request for review
5. Ask if I want to approve it (requires admin)

Amount: ${amount} (display currency, multiply by 100 for API)`,
      },
    }],
  }));

  server.prompt('financial-health-check', 'Get a comprehensive financial health overview', {
    entity: z.string().optional().describe('Entity code to filter by'),
  }, async ({ entity }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Give me a comprehensive financial health check${entity ? ` for entity "${entity}"` : ''}:

1. Call get_balance_sheet${entity ? ` with entity filter` : ''}
2. Call get_accounts_receivable to see outstanding invoices
3. Call get_accounts_payable to see pending expenses
4. Call get_breakeven_analysis for this month
5. Call get_client_health to identify at-risk clients
6. Call get_recurring_overview for projected monthly cash flow

Summarize:
- Current cash position
- Outstanding receivables vs payables
- Breakeven status
- Any overdue invoices or at-risk clients
- Projected recurring income vs expenses`,
      },
    }],
  }));
}
