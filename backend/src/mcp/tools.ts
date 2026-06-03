import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest as defaultApiRequest, type ApiRequestFn } from './client.js';

const OptStr = z.string().nullish();
const ReqStr = z.string();
const OptNum = z.number().nullish();
const AmountInt = z.number().int().describe('Amount in cents (smallest currency unit). e.g. HK$520 = 52000');
const OptAmountInt = z.number().int().nullish().describe('Amount in cents (smallest currency unit)');

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  const statusMatch = msg.match(/\((\d+)\):/);
  const status = statusMatch ? parseInt(statusMatch[1]) : 500;
  let detail: string = msg;
  try {
    const jsonMatch = msg.match(/:\s*({.+})\s*$/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[1]);
      detail = obj.error || obj.message || msg;
    }
  } catch { /* keep raw message */ }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: detail, status }) }],
    isError: true as const,
  };
}

export function registerTools(server: McpServer, api: ApiRequestFn = defaultApiRequest) {

  // ──────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────

  server.tool('get_current_user', 'Get the currently authenticated user profile', {}, async () => {
    try { return ok(await api('GET', '/auth/me')); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Entities
  // ──────────────────────────────────────────

  server.tool('list_entities', 'List all entities (companies)', {}, async () => {
    try { return ok(await api('GET', '/entities')); } catch (e) { return fail(e); }
  });

  server.tool('get_entity', 'Get entity details by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/entities/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_entity', 'Create a new entity', {
    code: ReqStr, name: ReqStr, address: OptStr, phone: OptStr, email: OptStr,
    website: OptStr, brandColor: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/entities', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_entity', 'Update an entity (partial update)', {
    id: ReqStr, code: OptStr, name: OptStr, address: OptStr, phone: OptStr,
    email: OptStr, website: OptStr, brandColor: OptStr, active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    try { return ok(await api('PUT', `/entities/${id}`, body)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Clients
  // ──────────────────────────────────────────

  server.tool('list_clients', 'List clients with optional search and entity filter', {
    search: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/clients', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_client', 'Get a client by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/clients/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_client', 'Create a new client', {
    name: ReqStr, entity: OptStr, email: OptStr, phone: OptStr,
    address: OptStr, contactPerson: OptStr, notes: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/clients', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_client', 'Update a client (partial update)', {
    id: ReqStr, name: OptStr, entity: OptStr, email: OptStr, phone: OptStr,
    address: OptStr, contactPerson: OptStr, notes: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('PATCH', `/clients/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_client', 'Delete a client', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/clients/${id}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Quotations
  // ──────────────────────────────────────────

  server.tool('list_quotations', 'List quotations with optional filters', {
    status: OptStr.describe('Filter: draft, pending_approval, sent, accepted, rejected'),
    client: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/quotations', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_quotation', 'Get a quotation by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/quotations/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_quotation', 'Create a new quotation', {
    entity: ReqStr, client: ReqStr, title: ReqStr,
    lineItems: z.string().describe('JSON array of {description, quantity, unitPrice (cents), amount (cents)}'),
    subtotal: AmountInt, total: AmountInt,
    discount: z.number().int().optional().describe('Discount in cents (default 0)'),
    validUntil: OptStr, notes: OptStr,
    paymentSchedule: z.string().optional().describe('JSON array of {milestone, percentage, amount (cents), dueDescription}'),
  }, async ({ lineItems, paymentSchedule, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest, lineItems: JSON.parse(lineItems) };
      if (paymentSchedule) body.paymentSchedule = JSON.parse(paymentSchedule);
      return ok(await api('POST', '/quotations', body));
    } catch (e) { return fail(e); }
  });

  server.tool('update_quotation', 'Update a quotation (partial update, draft only)', {
    id: ReqStr, client: OptStr, title: OptStr, validUntil: OptStr,
    lineItems: z.string().optional().describe('JSON array of line items'),
    subtotal: OptAmountInt, total: OptAmountInt,
    discount: z.number().int().optional(),
    notes: OptStr,
    paymentSchedule: z.string().optional().describe('JSON array of payment schedule items'),
  }, async ({ id, lineItems, paymentSchedule, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest };
      if (lineItems) body.lineItems = JSON.parse(lineItems);
      if (paymentSchedule) body.paymentSchedule = JSON.parse(paymentSchedule);
      return ok(await api('PATCH', `/quotations/${id}`, body));
    } catch (e) { return fail(e); }
  });

  server.tool('change_quotation_status', 'Change quotation status', {
    id: ReqStr, status: ReqStr.describe('One of: pending_approval, sent, accepted, rejected'),
  }, async ({ id, status }) => {
    try { return ok(await api('PATCH', `/quotations/${id}/status`, { status })); } catch (e) { return fail(e); }
  });

  server.tool('approve_quotation', 'Approve a pending quotation (admin)', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('PATCH', `/quotations/${id}/approve`)); } catch (e) { return fail(e); }
  });

  server.tool('reject_quotation', 'Reject a pending quotation (admin)', {
    id: ReqStr, reason: OptStr,
  }, async ({ id, reason }) => {
    try { return ok(await api('PATCH', `/quotations/${id}/reject`, reason ? { reason } : undefined)); } catch (e) { return fail(e); }
  });

  server.tool('notify_quotation', 'Send quotation by email to specified recipients', {
    id: ReqStr, emails: z.array(z.string()).describe('Array of email addresses'),
  }, async ({ id, emails }) => {
    try { return ok(await api('POST', `/quotations/${id}/notify`, { emails })); } catch (e) { return fail(e); }
  });

  server.tool('get_quotation_pdf', 'Get quotation PDF download URL', {
    id: ReqStr,
  }, async ({ id }) => {
    try {
      const data = await api('GET', `/quotations/${id}`);
      return ok({ pdfUrl: `/api/quotations/${id}/pdf`, quotation: data });
    } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Invoices
  // ──────────────────────────────────────────

  server.tool('list_invoices', 'List invoices with optional filters', {
    status: OptStr.describe('Filter: draft, unpaid, partial, paid'),
    client: OptStr, entity: OptStr, quotation: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/invoices', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_invoice', 'Get an invoice by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/invoices/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_invoice', 'Create a new invoice', {
    entity: ReqStr, client: ReqStr,
    lineItems: z.string().describe('JSON array of {description, quantity, unitPrice (cents), amount (cents)}'),
    subtotal: AmountInt, total: AmountInt,
    discount: z.number().int().optional().describe('Discount in cents (default 0)'),
    dueDate: OptStr, notes: OptStr,
    paymentTerms: OptStr, bankAccountInfo: OptStr,
    milestone: OptStr,
  }, async ({ lineItems, ...rest }) => {
    try {
      return ok(await api('POST', '/invoices', { ...rest, lineItems: JSON.parse(lineItems) }));
    } catch (e) { return fail(e); }
  });

  server.tool('update_invoice', 'Update an invoice (partial update)', {
    id: ReqStr, client: OptStr, dueDate: OptStr,
    lineItems: z.string().optional().describe('JSON array of line items'),
    subtotal: OptAmountInt, total: OptAmountInt,
    discount: z.number().int().optional(),
    notes: OptStr, paymentTerms: OptStr, bankAccountInfo: OptStr,
    milestone: OptStr,
  }, async ({ id, lineItems, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest };
      if (lineItems) body.lineItems = JSON.parse(lineItems);
      return ok(await api('PATCH', `/invoices/${id}`, body));
    } catch (e) { return fail(e); }
  });

  server.tool('change_invoice_status', 'Change invoice status', {
    id: ReqStr, status: ReqStr.describe('One of: draft, unpaid, partial, paid'),
  }, async ({ id, status }) => {
    try { return ok(await api('PATCH', `/invoices/${id}/status`, { status })); } catch (e) { return fail(e); }
  });

  server.tool('delete_invoice', 'Delete an invoice and its linked receipts/transactions', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/invoices/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_invoice_from_quotation', 'Create invoice(s) from an accepted quotation', {
    quotationId: ReqStr,
  }, async ({ quotationId }) => {
    try { return ok(await api('POST', `/invoices/from-quotation/${quotationId}`)); } catch (e) { return fail(e); }
  });

  server.tool('get_invoice_pdf', 'Get invoice PDF download URL', {
    id: ReqStr, includeChop: z.boolean().optional(), includeSignature: z.boolean().optional(),
  }, async ({ id, includeChop, includeSignature }) => {
    try {
      const params: Record<string, string> = {};
      if (includeChop != null) params.includeChop = String(includeChop);
      if (includeSignature != null) params.includeSignature = String(includeSignature);
      const qs = new URLSearchParams(params).toString();
      const data = await api('GET', `/invoices/${id}`);
      return ok({ pdfUrl: `/api/invoices/${id}/pdf${qs ? '?' + qs : ''}`, invoice: data });
    } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Receipts
  // ──────────────────────────────────────────

  server.tool('list_receipts', 'List receipts', { entity: OptStr }, async (args) => {
    try { return ok(await api('GET', '/receipts', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_receipt', 'Get a receipt by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/receipts/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_receipt', 'Record a payment (receipt) against an invoice', {
    invoice: ReqStr, amount: AmountInt, paymentDate: ReqStr,
    paymentMethod: OptStr.describe('Default: bank_transfer'),
    bankAccount: OptStr, bankReference: OptStr, notes: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/receipts', args)); } catch (e) { return fail(e); }
  });

  server.tool('delete_receipt', 'Delete a receipt and reverse the payment', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/receipts/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('get_receipt_pdf', 'Get receipt PDF download URL', {
    id: ReqStr,
  }, async ({ id }) => {
    try {
      const data = await api('GET', `/receipts/${id}`);
      return ok({ pdfUrl: `/api/receipts/${id}/pdf`, receipt: data });
    } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Transactions
  // ──────────────────────────────────────────

  server.tool('list_transactions', 'List transactions with optional filters', {
    type: OptStr.describe('Filter: income or expense'),
    category: OptStr, startDate: OptStr, endDate: OptStr,
    reconciled: OptStr.describe('"true" or "false"'), entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/transactions', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_transaction', 'Get a transaction by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/transactions/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_transaction', 'Create a manual transaction', {
    date: ReqStr, accountingDate: OptStr,
    type: ReqStr.describe('One of: income, expense'),
    category: ReqStr, amount: AmountInt,
    description: ReqStr, entity: OptStr, bankAccount: OptStr,
    bankReference: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/transactions', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_transaction', 'Update a transaction (partial update via PATCH)', {
    id: ReqStr, date: OptStr, accountingDate: OptStr, type: OptStr, category: OptStr,
    amount: OptAmountInt, description: OptStr, entity: OptStr,
    client: OptStr, payee: OptStr, invoice: OptStr, receipt: OptStr,
    paymentRequest: OptStr, bankReference: OptStr, bankAccount: OptStr,
    reconciled: z.boolean().nullish(),
  }, async ({ id, ...body }) => {
    try { return ok(await api('PATCH', `/transactions/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_transaction', 'Delete a transaction', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/transactions/${id}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Payees
  // ──────────────────────────────────────────

  server.tool('list_payees', 'List payees', { entity: OptStr }, async (args) => {
    try { return ok(await api('GET', '/payees', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('create_payee', 'Create a payee', {
    name: ReqStr, entity: OptStr, bankName: OptStr, bankAccountNumber: OptStr,
    bankCode: OptStr, notes: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/payees', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_payee', 'Update a payee (partial update)', {
    id: ReqStr, name: OptStr, entity: OptStr, bankName: OptStr,
    bankAccountNumber: OptStr, bankCode: OptStr, notes: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('PATCH', `/payees/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_payee', 'Delete a payee', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/payees/${id}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Payment Requests (Expense Approvals)
  // ──────────────────────────────────────────

  server.tool('list_payment_requests', 'List expense approval requests', {
    status: OptStr.describe('Filter: pending, approved, rejected, executed'),
    entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/payment-requests', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_payment_request', 'Get payment request by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/payment-requests/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_payment_request', 'Create a new expense approval request', {
    entity: OptStr, description: OptStr,
    items: z.string().describe('JSON array of {payee, description, amount (cents int), category, recipient?, disbursementType? ("bank"|"liability_offset"), shareholderId?}'),
    sourceBankAccount: OptStr, attachments: z.string().optional().describe('JSON array of attachment URLs'),
  }, async ({ items, attachments, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest, items: JSON.parse(items) };
      if (attachments) body.attachments = JSON.parse(attachments);
      return ok(await api('POST', '/payment-requests', body));
    } catch (e) { return fail(e); }
  });

  server.tool('update_payment_request', 'Update a payment request (partial update)', {
    id: ReqStr, description: OptStr,
    items: z.string().optional().describe('JSON array of {payee, description, amount (cents int), category, recipient?, disbursementType? ("bank"|"liability_offset"), shareholderId?}'),
    sourceBankAccount: OptStr, attachments: z.string().optional().describe('JSON array of attachment URLs'),
  }, async ({ id, items, attachments, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest };
      if (items) body.items = JSON.parse(items);
      if (attachments) body.attachments = JSON.parse(attachments);
      return ok(await api('PATCH', `/payment-requests/${id}`, body));
    } catch (e) { return fail(e); }
  });

  server.tool('delete_payment_request', 'Delete a payment request', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/payment-requests/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('approve_payment_request', 'Approve a payment request (admin)', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('PATCH', `/payment-requests/${id}/approve`)); } catch (e) { return fail(e); }
  });

  server.tool('reject_payment_request', 'Reject a payment request (admin)', {
    id: ReqStr, reason: ReqStr.describe('Reason for rejection (required)'),
  }, async ({ id, reason }) => {
    try { return ok(await api('PATCH', `/payment-requests/${id}/reject`, { reason })); } catch (e) { return fail(e); }
  });

  server.tool('execute_payment_request', 'Execute an approved payment request — creates expense transactions', {
    id: ReqStr, bankReference: OptStr,
  }, async ({ id, bankReference }) => {
    try { return ok(await api('PATCH', `/payment-requests/${id}/execute`, { bankReference })); } catch (e) { return fail(e); }
  });

  server.tool('notify_payment_request', 'Send payment request approval notification emails', {
    id: ReqStr, emails: z.array(z.string()).describe('Array of email addresses'),
  }, async ({ id, emails }) => {
    try { return ok(await api('POST', `/payment-requests/${id}/notify`, { emails })); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Reimbursements
  // ──────────────────────────────────────────

  server.tool('list_reimbursements', 'List reimbursement claims', {}, async () => {
    try { return ok(await api('GET', '/reimbursements')); } catch (e) { return fail(e); }
  });

  server.tool('get_reimbursement', 'Get reimbursement by ID', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/reimbursements/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('create_reimbursement', 'Create a reimbursement claim', {
    title: ReqStr, entity: ReqStr,
    items: z.string().describe('JSON array of {description, amount (cents int), category, date, receiptUrl?}'),
  }, async ({ items, ...rest }) => {
    try { return ok(await api('POST', '/reimbursements', { ...rest, items: JSON.parse(items) })); } catch (e) { return fail(e); }
  });

  server.tool('update_reimbursement', 'Update a reimbursement claim', {
    id: ReqStr, title: OptStr,
    items: z.string().optional().describe('JSON array of items'),
  }, async ({ id, items, ...rest }) => {
    try {
      const body: Record<string, unknown> = { ...rest };
      if (items) body.items = JSON.parse(items);
      return ok(await api('PUT', `/reimbursements/${id}`, body));
    } catch (e) { return fail(e); }
  });

  server.tool('delete_reimbursement', 'Delete a reimbursement claim', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/reimbursements/${id}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Recurring Items
  // ──────────────────────────────────────────

  server.tool('list_recurring', 'List recurring items', { entity: OptStr }, async (args) => {
    try { return ok(await api('GET', '/recurring', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('create_recurring', 'Create a recurring item', {
    name: ReqStr.describe('Display name for the recurring item'),
    type: ReqStr.describe('One of: income, expense'),
    frequency: ReqStr.describe('One of: monthly, quarterly, yearly'),
    amount: AmountInt,
    category: ReqStr.describe('Use get_settings to see valid categories'),
    description: OptStr,
    entity: OptStr,
    client: OptStr.describe('Required when type=income'),
    payee: OptStr.describe('Recommended when type=expense'),
    startDate: OptStr, endDate: OptStr,
    dueDay: OptNum.describe('Day of month (1-28) for due date'),
    alertDaysBefore: OptNum, paymentTerms: OptStr, bankAccountInfo: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/recurring', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_recurring', 'Update a recurring item (partial update)', {
    id: ReqStr, name: OptStr, type: OptStr, frequency: OptStr, amount: OptAmountInt,
    description: OptStr, category: OptStr, entity: OptStr,
    client: OptStr, payee: OptStr, startDate: OptStr,
    endDate: OptStr, dueDay: OptNum, active: z.boolean().optional(),
    alertDaysBefore: OptNum, paymentTerms: OptStr, bankAccountInfo: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('PATCH', `/recurring/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_recurring', 'Delete a recurring item', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/recurring/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('generate_recurring', 'Batch-generate invoices/payment requests for all due recurring items this month', {}, async () => {
    try { return ok(await api('POST', '/recurring/generate')); } catch (e) { return fail(e); }
  });

  server.tool('generate_recurring_invoice', 'Manually generate invoice for a specific income recurring item', {
    id: ReqStr,
  }, async ({ id }) => {
    try { return ok(await api('POST', `/recurring/${id}/generate-invoice`)); } catch (e) { return fail(e); }
  });

  server.tool('generate_recurring_payment_request', 'Manually generate payment request for a specific expense recurring item', {
    id: ReqStr,
  }, async ({ id }) => {
    try { return ok(await api('POST', `/recurring/${id}/generate-payment-request`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Shareholders
  // ──────────────────────────────────────────

  server.tool('list_shareholders', 'List all shareholders with equity summary', {}, async () => {
    try { return ok(await api('GET', '/shareholders')); } catch (e) { return fail(e); }
  });

  server.tool('get_shareholder', 'Get shareholder details and equity transactions', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/shareholders/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('get_shareholders_summary', 'Get aggregated shareholder equity summary', {}, async () => {
    try { return ok(await api('GET', '/shareholders/summary')); } catch (e) { return fail(e); }
  });

  server.tool('get_shareholder_history', 'Get share percentage change history for a shareholder', {
    id: ReqStr,
  }, async ({ id }) => {
    try { return ok(await api('GET', `/shareholders/${id}/history`)); } catch (e) { return fail(e); }
  });

  server.tool('create_shareholder', 'Create a new shareholder (admin)', {
    name: ReqStr, user: ReqStr.describe('User ID to link this shareholder to'),
    sharePercent: z.number().min(0).max(100),
  }, async (args) => {
    try { return ok(await api('POST', '/shareholders', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_shareholder', 'Update shareholder info (admin)', {
    id: ReqStr, name: OptStr, sharePercent: OptNum, active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    try { return ok(await api('PUT', `/shareholders/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('transfer_shares', 'Transfer share % between shareholders (admin)', {
    from: ReqStr.describe('Source shareholder ID'),
    to: ReqStr.describe('Target shareholder ID'),
    percent: z.number().positive().max(100),
    reason: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/shareholders/transfer', args)); } catch (e) { return fail(e); }
  });

  server.tool('record_investment', 'Record an investment for a shareholder (admin)', {
    id: ReqStr, amount: AmountInt, date: ReqStr, description: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('POST', `/shareholders/${id}/invest`, body)); } catch (e) { return fail(e); }
  });

  server.tool('list_shareholder_liabilities', 'List share purchase liabilities for a shareholder', {
    id: ReqStr,
  }, async ({ id }) => {
    try { return ok(await api('GET', `/shareholders/${id}/liabilities`)); } catch (e) { return fail(e); }
  });

  server.tool('add_shareholder_liability', 'Add a share liability entry (admin)', {
    id: ReqStr, type: ReqStr.describe('One of: purchase, payment'),
    amount: AmountInt, date: ReqStr, description: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('POST', `/shareholders/${id}/liabilities`, body)); } catch (e) { return fail(e); }
  });

  server.tool('update_shareholder_liability', 'Update a liability entry (admin)', {
    id: ReqStr, entryId: ReqStr,
    amount: OptAmountInt, date: OptStr, description: OptStr,
  }, async ({ id, entryId, ...body }) => {
    try { return ok(await api('PUT', `/shareholders/${id}/liabilities/${entryId}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_shareholder_liability', 'Delete a liability entry (admin)', {
    id: ReqStr, entryId: ReqStr,
  }, async ({ id, entryId }) => {
    try { return ok(await api('DELETE', `/shareholders/${id}/liabilities/${entryId}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Monthly Close
  // ──────────────────────────────────────────

  server.tool('list_monthly_closes', 'List monthly close records', { entity: OptStr }, async (args) => {
    try { return ok(await api('GET', '/monthly-close', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_monthly_close', 'Get or preview a monthly close', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    try { return ok(await api('GET', `/monthly-close/${entity}/${year}/${month}`)); } catch (e) { return fail(e); }
  });

  server.tool('get_monthly_close_summary', 'Get monthly close group summary across entities', {
    year: z.number(), month: z.number().optional(),
  }, async ({ year, month }) => {
    try {
      const path = month != null ? `/monthly-close/summary/${year}/${month}` : `/monthly-close/summary/${year}`;
      return ok(await api('GET', path));
    } catch (e) { return fail(e); }
  });

  server.tool('preview_monthly_close', 'Recompute monthly close preview', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    try { return ok(await api('POST', `/monthly-close/${entity}/${year}/${month}/preview`)); } catch (e) { return fail(e); }
  });

  server.tool('submit_monthly_close', 'Submit monthly close for approval (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(), notes: OptStr,
  }, async ({ entity, year, month, notes }) => {
    try { return ok(await api('POST', `/monthly-close/${entity}/${year}/${month}/submit`, { notes })); } catch (e) { return fail(e); }
  });

  server.tool('approve_monthly_close', 'Approve a pending monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    try { return ok(await api('PATCH', `/monthly-close/${entity}/${year}/${month}/approve`)); } catch (e) { return fail(e); }
  });

  server.tool('reject_monthly_close', 'Reject a pending monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(),
    reason: ReqStr.describe('Reason for rejection'),
  }, async ({ entity, year, month, reason }) => {
    try { return ok(await api('PATCH', `/monthly-close/${entity}/${year}/${month}/reject`, { reason })); } catch (e) { return fail(e); }
  });

  server.tool('notify_monthly_close', 'Send monthly close notification emails', {
    entity: ReqStr, year: z.number(), month: z.number(),
    emails: z.array(z.string()).describe('Array of email addresses'),
  }, async ({ entity, year, month, emails }) => {
    try { return ok(await api('POST', `/monthly-close/${entity}/${year}/${month}/notify`, { emails })); } catch (e) { return fail(e); }
  });

  server.tool('get_distribution_options', 'Get profit distribution options for monthly close', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    try { return ok(await api('GET', `/monthly-close/${entity}/${year}/${month}/distribution-options`)); } catch (e) { return fail(e); }
  });

  server.tool('finalize_monthly_close', 'Finalize an approved monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(), notes: OptStr,
    distributionMethods: z.string().optional().describe('JSON array of {shareholder (ID), method ("cash" or "offset_liability")}'),
  }, async ({ entity, year, month, notes, distributionMethods }) => {
    try {
      const body: Record<string, unknown> = { notes };
      if (distributionMethods) body.distributionMethods = JSON.parse(distributionMethods);
      return ok(await api('POST', `/monthly-close/${entity}/${year}/${month}/finalize`, body));
    } catch (e) { return fail(e); }
  });

  server.tool('create_collection_requests', 'Create collection requests after a loss month', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    try { return ok(await api('POST', `/monthly-close/${entity}/${year}/${month}/create-collection-requests`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Funds
  // ──────────────────────────────────────────

  server.tool('list_funds', 'List all funds', {}, async () => {
    try { return ok(await api('GET', '/funds')); } catch (e) { return fail(e); }
  });

  server.tool('create_fund', 'Create a new fund (admin)', {
    name: ReqStr, type: ReqStr, entity: OptStr, heldIn: OptStr,
    openingBalance: OptAmountInt, balance: OptAmountInt,
  }, async (args) => {
    try { return ok(await api('POST', '/funds', args)); } catch (e) { return fail(e); }
  });

  server.tool('update_fund', 'Update a fund (admin)', {
    id: ReqStr, name: OptStr, type: OptStr, entity: OptStr,
    heldIn: OptStr, openingBalance: OptAmountInt, balance: OptAmountInt,
    active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    try { return ok(await api('PUT', `/funds/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_fund', 'Delete a fund (admin, balance must be 0)', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/funds/${id}`)); } catch (e) { return fail(e); }
  });

  server.tool('transfer_funds', 'Transfer between funds', {
    fromFund: OptStr, toFund: OptStr, amount: AmountInt,
    date: ReqStr, description: ReqStr, reference: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/funds/transfer', args)); } catch (e) { return fail(e); }
  });

  server.tool('get_fund_transactions', 'Get transfer history for a fund', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('GET', `/funds/${id}/transactions`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Reports
  // ──────────────────────────────────────────

  server.tool('get_cash_flow', 'Get monthly cash flow report', {
    year: z.string().optional(), month: z.string().optional(), entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/cash-flow', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_income_statement', 'Get income statement by category', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/income-statement', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_income_statement_transactions', 'Drill down into income statement — list transactions for a type and category', {
    type: ReqStr.describe('income or expense'),
    category: ReqStr,
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/income-statement/transactions', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_accounts_receivable', 'Get accounts receivable report', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/accounts-receivable', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_accounts_payable', 'Get accounts payable report', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/accounts-payable', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_balance_sheet', 'Get balance sheet snapshot', { entity: OptStr }, async (args) => {
    try { return ok(await api('GET', '/reports/balance-sheet', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_monthly_summary', 'Get monthly summary with opening/closing positions', {
    year: z.string(), month: z.string(), entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/monthly-summary', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_recurring_overview', 'Get recurring items overview and monthly estimates', {}, async () => {
    try { return ok(await api('GET', '/reports/recurring-overview')); } catch (e) { return fail(e); }
  });

  server.tool('get_breakeven_analysis', 'Get breakeven analysis: recurring obligations vs income, AR/AP, and gap to breakeven', {
    year: z.string().optional(), month: z.string().optional(), entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/breakeven-analysis', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('get_client_health', 'Get per-client AR aging, overdue days, and recurring income flags', {
    entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/reports/client-health', undefined, args)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Intercompany Transfers
  // ──────────────────────────────────────────

  server.tool('list_intercompany_transfers', 'List intercompany transfers', {}, async () => {
    try { return ok(await api('GET', '/intercompany-transfers')); } catch (e) { return fail(e); }
  });

  server.tool('create_intercompany_transfer', 'Create an intercompany transfer between two entities', {
    fromEntity: ReqStr, toEntity: ReqStr, amount: AmountInt,
    date: ReqStr, description: ReqStr,
    fromBankAccount: OptStr, toBankAccount: OptStr,
  }, async (args) => {
    try { return ok(await api('POST', '/intercompany-transfers', args)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────

  server.tool('list_users', 'List all users', {}, async () => {
    try { return ok(await api('GET', '/users')); } catch (e) { return fail(e); }
  });

  server.tool('update_user', 'Update a user (admin)', {
    id: ReqStr, name: OptStr, email: OptStr, role: OptStr,
    active: z.boolean().optional(), password: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('PUT', `/users/${id}`, body)); } catch (e) { return fail(e); }
  });

  server.tool('delete_user', 'Deactivate a user (admin)', { id: ReqStr }, async ({ id }) => {
    try { return ok(await api('DELETE', `/users/${id}`)); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Settings
  // ──────────────────────────────────────────

  server.tool('get_settings', 'Get application settings (includes valid categories, entity defaults, etc.)', {}, async () => {
    try { return ok(await api('GET', '/settings')); } catch (e) { return fail(e); }
  });

  server.tool('update_settings', 'Update application settings (admin)', {
    settings: z.string().describe('JSON object of settings to update'),
  }, async ({ settings }) => {
    try { return ok(await api('PUT', '/settings', JSON.parse(settings))); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // Airwallex
  // ──────────────────────────────────────────

  server.tool('get_airwallex_status', 'Get Airwallex sync status, token info, and balance comparison', {}, async () => {
    try { return ok(await api('GET', '/airwallex/status')); } catch (e) { return fail(e); }
  });

  server.tool('trigger_airwallex_sync', 'Trigger Airwallex bank sync for an entity', {
    entity: z.string().describe('"ax" for Axilogy or "nt" for Naton'),
  }, async ({ entity }) => {
    try { return ok(await api('POST', `/airwallex/sync/${entity}`)); } catch (e) { return fail(e); }
  });

  server.tool('get_airwallex_sync_logs', 'Get recent Airwallex sync logs', {
    limit: z.string().optional(),
  }, async (args) => {
    try { return ok(await api('GET', '/airwallex/sync-logs', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('list_pending_bank_transactions', 'List unmatched bank transactions awaiting review', {
    entity: OptStr,
  }, async (args) => {
    try { return ok(await api('GET', '/airwallex/pending', undefined, args)); } catch (e) { return fail(e); }
  });

  server.tool('match_pending_transaction', 'Link a pending bank transaction to an existing system transaction', {
    id: ReqStr, transactionId: ReqStr,
  }, async ({ id, transactionId }) => {
    try { return ok(await api('POST', `/airwallex/pending/${id}/match`, { transactionId })); } catch (e) { return fail(e); }
  });

  server.tool('create_from_pending', 'Create a new system transaction from a pending bank transaction', {
    id: ReqStr, category: ReqStr, description: ReqStr, fund: OptStr,
  }, async ({ id, ...body }) => {
    try { return ok(await api('POST', `/airwallex/pending/${id}/create`, body)); } catch (e) { return fail(e); }
  });

  server.tool('dismiss_pending', 'Dismiss a pending bank transaction', {
    id: ReqStr, note: OptStr,
  }, async ({ id, note }) => {
    try { return ok(await api('POST', `/airwallex/pending/${id}/dismiss`, { note })); } catch (e) { return fail(e); }
  });

  // ──────────────────────────────────────────
  // File Upload
  // ──────────────────────────────────────────

  server.tool('upload_file', 'Upload a base64-encoded file (for receipts, logos, chops, signatures)', {
    filename: ReqStr, base64Data: ReqStr.describe('Base64-encoded file content (without data URI prefix)'),
    mimeType: OptStr.describe('e.g. image/png, image/jpeg, application/pdf'),
  }, async ({ filename, base64Data, mimeType }) => {
    try {
      return ok(await api('POST', '/uploads/base64', { filename, data: base64Data, mimeType }));
    } catch (e) { return fail(e); }
  });
}
