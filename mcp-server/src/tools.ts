import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiRequest as defaultApiRequest, type ApiRequestFn } from './client.js';

const OptStr = z.string().nullish();
const ReqStr = z.string();
const OptNum = z.number().nullish();

export function registerTools(server: McpServer, api: ApiRequestFn = defaultApiRequest) {

  // ──────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────

  server.tool('get_current_user', 'Get the currently authenticated user profile', {}, async () => {
    const data = await api('GET', '/auth/me');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Entities
  // ──────────────────────────────────────────

  server.tool('list_entities', 'List all entities (companies)', {}, async () => {
    const data = await api('GET', '/entities');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_entity', 'Get entity details by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/entities/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_entity', 'Create a new entity', {
    code: ReqStr, name: ReqStr, address: OptStr, phone: OptStr, email: OptStr,
    website: OptStr, brandColor: OptStr,
  }, async (args) => {
    const data = await api('POST', '/entities', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_entity', 'Update an entity', {
    id: ReqStr, code: OptStr, name: OptStr, address: OptStr, phone: OptStr,
    email: OptStr, website: OptStr, brandColor: OptStr, active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/entities/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Clients
  // ──────────────────────────────────────────

  server.tool('list_clients', 'List clients with optional search and entity filter', {
    search: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/clients', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_client', 'Get a client by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/clients/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_client', 'Create a new client', {
    name: ReqStr, entity: OptStr, email: OptStr, phone: OptStr,
    address: OptStr, contactPerson: OptStr, notes: OptStr,
  }, async (args) => {
    const data = await api('POST', '/clients', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_client', 'Update a client', {
    id: ReqStr, name: OptStr, entity: OptStr, email: OptStr, phone: OptStr,
    address: OptStr, contactPerson: OptStr, notes: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/clients/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_client', 'Delete a client', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/clients/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Quotations
  // ──────────────────────────────────────────

  server.tool('list_quotations', 'List quotations with optional filters', {
    status: OptStr, client: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/quotations', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_quotation', 'Get a quotation by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/quotations/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_quotation', 'Create a new quotation', {
    entity: ReqStr, client: ReqStr, validUntil: OptStr,
    lineItems: z.string().describe('JSON array of {description, quantity, unitPrice, amount}'),
    notes: OptStr, internalNotes: OptStr,
  }, async ({ lineItems, ...rest }) => {
    const data = await api('POST', '/quotations', { ...rest, lineItems: JSON.parse(lineItems) });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_quotation', 'Update a quotation (draft only)', {
    id: ReqStr, client: OptStr, validUntil: OptStr,
    lineItems: z.string().optional().describe('JSON array of line items'),
    notes: OptStr, internalNotes: OptStr,
  }, async ({ id, lineItems, ...rest }) => {
    const body: Record<string, unknown> = { ...rest };
    if (lineItems) body.lineItems = JSON.parse(lineItems);
    const data = await api('PUT', `/quotations/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('change_quotation_status', 'Change quotation status', {
    id: ReqStr, status: ReqStr,
  }, async ({ id, status }) => {
    const data = await api('PATCH', `/quotations/${id}/status`, { status });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('approve_quotation', 'Approve a pending quotation (admin)', { id: ReqStr }, async ({ id }) => {
    const data = await api('PATCH', `/quotations/${id}/approve`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('reject_quotation', 'Reject a pending quotation (admin)', {
    id: ReqStr, reason: OptStr,
  }, async ({ id, reason }) => {
    const data = await api('PATCH', `/quotations/${id}/reject`, reason ? { reason } : undefined);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Invoices
  // ──────────────────────────────────────────

  server.tool('list_invoices', 'List invoices with optional filters', {
    status: OptStr, client: OptStr, entity: OptStr, quotation: OptStr,
  }, async (args) => {
    const data = await api('GET', '/invoices', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_invoice', 'Get an invoice by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/invoices/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_invoice', 'Create a new invoice', {
    entity: ReqStr, client: ReqStr,
    lineItems: z.string().describe('JSON array of {description, quantity, unitPrice, amount}'),
    dueDate: OptStr, notes: OptStr,
  }, async ({ lineItems, ...rest }) => {
    const data = await api('POST', '/invoices', { ...rest, lineItems: JSON.parse(lineItems) });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_invoice', 'Update an invoice', {
    id: ReqStr, client: OptStr, dueDate: OptStr,
    lineItems: z.string().optional().describe('JSON array of line items'),
    notes: OptStr,
  }, async ({ id, lineItems, ...rest }) => {
    const body: Record<string, unknown> = { ...rest };
    if (lineItems) body.lineItems = JSON.parse(lineItems);
    const data = await api('PUT', `/invoices/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('change_invoice_status', 'Change invoice status (unpaid/partial/paid)', {
    id: ReqStr, status: ReqStr,
  }, async ({ id, status }) => {
    const data = await api('PATCH', `/invoices/${id}/status`, { status });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_invoice', 'Delete an invoice and its linked receipts/transactions', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/invoices/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_invoice_from_quotation', 'Create invoice(s) from an accepted quotation', {
    quotationId: ReqStr,
  }, async ({ quotationId }) => {
    const data = await api('POST', `/invoices/from-quotation/${quotationId}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Receipts
  // ──────────────────────────────────────────

  server.tool('list_receipts', 'List receipts', { entity: OptStr }, async (args) => {
    const data = await api('GET', '/receipts', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_receipt', 'Get a receipt by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/receipts/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_receipt', 'Record a payment (receipt) against an invoice', {
    invoice: ReqStr, amount: z.number(), paymentDate: ReqStr,
    paymentMethod: OptStr, bankAccount: OptStr, reference: OptStr, notes: OptStr,
  }, async (args) => {
    const data = await api('POST', '/receipts', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_receipt', 'Delete a receipt and reverse the payment', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/receipts/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Transactions
  // ──────────────────────────────────────────

  server.tool('list_transactions', 'List transactions with optional filters', {
    type: OptStr, category: OptStr, startDate: OptStr, endDate: OptStr,
    reconciled: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/transactions', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_transaction', 'Get a transaction by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/transactions/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_transaction', 'Create a manual transaction', {
    date: ReqStr, type: ReqStr, category: ReqStr, amount: z.number(),
    description: ReqStr, entity: OptStr, bankAccount: OptStr,
    fund: OptStr, reference: OptStr,
  }, async (args) => {
    const data = await api('POST', '/transactions', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_transaction', 'Update a transaction (partial update)', {
    id: ReqStr, date: OptStr, accountingDate: OptStr, type: OptStr, category: OptStr,
    amount: OptNum, description: OptStr, entity: OptStr,
    client: OptStr, payee: OptStr, invoice: OptStr, receipt: OptStr,
    paymentRequest: OptStr, bankReference: OptStr, bankAccount: OptStr,
    reconciled: { type: 'boolean', nullable: true },
  }, async ({ id, ...body }) => {
    const data = await api('PATCH', `/transactions/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_transaction', 'Delete a transaction', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/transactions/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Payees
  // ──────────────────────────────────────────

  server.tool('list_payees', 'List payees', { entity: OptStr }, async (args) => {
    const data = await api('GET', '/payees', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_payee', 'Create a payee', {
    name: ReqStr, entity: OptStr, bankName: OptStr, bankAccountNumber: OptStr,
    bankAccountName: OptStr, notes: OptStr,
  }, async (args) => {
    const data = await api('POST', '/payees', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_payee', 'Update a payee', {
    id: ReqStr, name: OptStr, entity: OptStr, bankName: OptStr,
    bankAccountNumber: OptStr, bankAccountName: OptStr, notes: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/payees/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_payee', 'Delete a payee', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/payees/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Payment Requests (Expense Approvals)
  // ──────────────────────────────────────────

  server.tool('list_payment_requests', 'List expense approval requests', {
    status: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/payment-requests', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_payment_request', 'Get payment request by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/payment-requests/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_payment_request', 'Create a new expense approval request', {
    entity: ReqStr, description: OptStr,
    items: z.string().describe('JSON array of {payee, description, amount, category}'),
  }, async ({ items, ...rest }) => {
    const data = await api('POST', '/payment-requests', { ...rest, items: JSON.parse(items) });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_payment_request', 'Update a payment request', {
    id: ReqStr, description: OptStr,
    items: z.string().optional().describe('JSON array of items'),
  }, async ({ id, items, ...rest }) => {
    const body: Record<string, unknown> = { ...rest };
    if (items) body.items = JSON.parse(items);
    const data = await api('PUT', `/payment-requests/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_payment_request', 'Delete a payment request', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/payment-requests/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('approve_payment_request', 'Approve a payment request (admin)', { id: ReqStr }, async ({ id }) => {
    const data = await api('PATCH', `/payment-requests/${id}/approve`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('reject_payment_request', 'Reject a payment request (admin)', {
    id: ReqStr, reason: OptStr,
  }, async ({ id, reason }) => {
    const data = await api('PATCH', `/payment-requests/${id}/reject`, { reason });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('execute_payment_request', 'Execute an approved payment request — creates expense transactions', {
    id: ReqStr, paymentMethod: OptStr, bankAccount: OptStr, reference: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('PATCH', `/payment-requests/${id}/execute`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Reimbursements
  // ──────────────────────────────────────────

  server.tool('list_reimbursements', 'List reimbursement claims', {}, async () => {
    const data = await api('GET', '/reimbursements');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_reimbursement', 'Get reimbursement by ID', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/reimbursements/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_reimbursement', 'Create a reimbursement claim', {
    title: ReqStr, entity: ReqStr,
    items: z.string().describe('JSON array of {description, amount, category, date}'),
  }, async ({ items, ...rest }) => {
    const data = await api('POST', '/reimbursements', { ...rest, items: JSON.parse(items) });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_reimbursement', 'Update a reimbursement claim', {
    id: ReqStr, title: OptStr,
    items: z.string().optional().describe('JSON array of items'),
  }, async ({ id, items, ...rest }) => {
    const body: Record<string, unknown> = { ...rest };
    if (items) body.items = JSON.parse(items);
    const data = await api('PUT', `/reimbursements/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_reimbursement', 'Delete a reimbursement claim', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/reimbursements/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Recurring Items
  // ──────────────────────────────────────────

  server.tool('list_recurring', 'List recurring items', { entity: OptStr }, async (args) => {
    const data = await api('GET', '/recurring', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_recurring', 'Create a recurring item', {
    type: ReqStr, frequency: ReqStr, amount: z.number(),
    description: ReqStr, category: ReqStr, entity: OptStr,
    client: OptStr, payee: OptStr, startDate: ReqStr,
    endDate: OptStr, dueDay: OptNum,
  }, async (args) => {
    const data = await api('POST', '/recurring', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_recurring', 'Update a recurring item', {
    id: ReqStr, type: OptStr, frequency: OptStr, amount: OptNum,
    description: OptStr, category: OptStr, entity: OptStr,
    client: OptStr, payee: OptStr, startDate: OptStr,
    endDate: OptStr, dueDay: OptNum, active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/recurring/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_recurring', 'Delete a recurring item', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/recurring/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('generate_recurring', 'Batch-generate invoices/payment requests for current month', {}, async () => {
    const data = await api('POST', '/recurring/generate');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('generate_recurring_invoice', 'Manually generate invoice for a specific recurring item', {
    id: ReqStr,
  }, async ({ id }) => {
    const data = await api('POST', `/recurring/${id}/generate-invoice`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Shareholders
  // ──────────────────────────────────────────

  server.tool('list_shareholders', 'List all shareholders with equity summary', {}, async () => {
    const data = await api('GET', '/shareholders');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_shareholder', 'Get shareholder details and equity transactions', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/shareholders/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_shareholder', 'Create a new shareholder (admin)', {
    name: ReqStr, user: OptStr, sharePercent: z.number(),
  }, async (args) => {
    const data = await api('POST', '/shareholders', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_shareholder', 'Update shareholder info (admin)', {
    id: ReqStr, name: OptStr, sharePercent: OptNum, active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/shareholders/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('transfer_shares', 'Transfer share % between shareholders (admin)', {
    fromShareholder: ReqStr, toShareholder: ReqStr, percent: z.number(), reason: OptStr,
  }, async (args) => {
    const data = await api('POST', '/shareholders/transfer', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('record_investment', 'Record an investment for a shareholder (admin)', {
    id: ReqStr, amount: z.number(), description: OptStr, date: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('POST', `/shareholders/${id}/invest`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('list_shareholder_liabilities', 'List share purchase liabilities for a shareholder', {
    id: ReqStr,
  }, async ({ id }) => {
    const data = await api('GET', `/shareholders/${id}/liabilities`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('add_shareholder_liability', 'Add a share liability entry (admin)', {
    id: ReqStr, type: ReqStr, amount: z.number(), date: ReqStr, note: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('POST', `/shareholders/${id}/liabilities`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_shareholder_liability', 'Update a liability entry (admin)', {
    id: ReqStr, entryId: ReqStr, type: OptStr, amount: OptNum, date: OptStr, note: OptStr,
  }, async ({ id, entryId, ...body }) => {
    const data = await api('PUT', `/shareholders/${id}/liabilities/${entryId}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_shareholder_liability', 'Delete a liability entry (admin)', {
    id: ReqStr, entryId: ReqStr,
  }, async ({ id, entryId }) => {
    const data = await api('DELETE', `/shareholders/${id}/liabilities/${entryId}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Monthly Close
  // ──────────────────────────────────────────

  server.tool('list_monthly_closes', 'List monthly close records', { entity: OptStr }, async (args) => {
    const data = await api('GET', '/monthly-close', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_monthly_close', 'Get or preview a monthly close', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    const data = await api('GET', `/monthly-close/${entity}/${year}/${month}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('preview_monthly_close', 'Recompute monthly close preview', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    const data = await api('POST', `/monthly-close/${entity}/${year}/${month}/preview`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('submit_monthly_close', 'Submit monthly close for approval (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(), notes: OptStr,
  }, async ({ entity, year, month, notes }) => {
    const data = await api('POST', `/monthly-close/${entity}/${year}/${month}/submit`, { notes });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('approve_monthly_close', 'Approve a pending monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(),
  }, async ({ entity, year, month }) => {
    const data = await api('PATCH', `/monthly-close/${entity}/${year}/${month}/approve`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('reject_monthly_close', 'Reject a pending monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(), reason: ReqStr,
  }, async ({ entity, year, month, reason }) => {
    const data = await api('PATCH', `/monthly-close/${entity}/${year}/${month}/reject`, { reason });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('notify_monthly_close', 'Send monthly close notification emails', {
    entity: ReqStr, year: z.number(), month: z.number(), emails: z.array(z.string()),
  }, async ({ entity, year, month, emails }) => {
    const data = await api('POST', `/monthly-close/${entity}/${year}/${month}/notify`, { emails });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('finalize_monthly_close', 'Finalize an approved monthly close (admin)', {
    entity: ReqStr, year: z.number(), month: z.number(), notes: OptStr,
  }, async ({ entity, year, month, notes }) => {
    const data = await api('POST', `/monthly-close/${entity}/${year}/${month}/finalize`, { notes });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Funds
  // ──────────────────────────────────────────

  server.tool('list_funds', 'List all funds', {}, async () => {
    const data = await api('GET', '/funds');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_fund', 'Create a new fund (admin)', {
    name: ReqStr, type: ReqStr, entity: OptStr, heldIn: OptStr,
    openingBalance: OptNum, balance: OptNum,
  }, async (args) => {
    const data = await api('POST', '/funds', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_fund', 'Update a fund (admin)', {
    id: ReqStr, name: OptStr, type: OptStr, entity: OptStr,
    heldIn: OptStr, openingBalance: OptNum, balance: OptNum,
    active: z.boolean().optional(),
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/funds/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_fund', 'Delete a fund (admin, balance must be 0)', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/funds/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('transfer_funds', 'Transfer between funds', {
    fromFund: OptStr, toFund: OptStr, amount: z.number(),
    date: ReqStr, description: ReqStr, reference: OptStr,
  }, async (args) => {
    const data = await api('POST', '/funds/transfer', args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_fund_transactions', 'Get transfer history for a fund', { id: ReqStr }, async ({ id }) => {
    const data = await api('GET', `/funds/${id}/transactions`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Reports
  // ──────────────────────────────────────────

  server.tool('get_cash_flow', 'Get monthly cash flow report', {
    year: z.string().optional(), month: z.string().optional(), entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/cash-flow', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_income_statement', 'Get income statement by category', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/income-statement', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_accounts_receivable', 'Get accounts receivable report', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/accounts-receivable', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_accounts_payable', 'Get accounts payable report', {
    startDate: OptStr, endDate: OptStr, entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/accounts-payable', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_balance_sheet', 'Get balance sheet snapshot', { entity: OptStr }, async (args) => {
    const data = await api('GET', '/reports/balance-sheet', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_monthly_summary', 'Get monthly summary with opening/closing positions', {
    year: z.string(), month: z.string(), entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/monthly-summary', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_recurring_overview', 'Get recurring items overview and monthly estimates', {}, async () => {
    const data = await api('GET', '/reports/recurring-overview');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_breakeven_analysis', 'Get breakeven analysis: recurring obligations vs income, AR/AP, and gap to breakeven for a given month', {
    year: z.string().optional(), month: z.string().optional(), entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/breakeven-analysis', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_client_health', 'Get per-client AR aging, overdue days, and recurring income flags to identify retention-critical clients', {
    entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/reports/client-health', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Users
  // ──────────────────────────────────────────

  server.tool('list_users', 'List all users', {}, async () => {
    const data = await api('GET', '/users');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_user', 'Update a user (admin)', {
    id: ReqStr, name: OptStr, email: OptStr, role: OptStr,
    active: z.boolean().optional(), password: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('PUT', `/users/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('delete_user', 'Deactivate a user (admin)', { id: ReqStr }, async ({ id }) => {
    const data = await api('DELETE', `/users/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Settings
  // ──────────────────────────────────────────

  server.tool('get_settings', 'Get application settings', {}, async () => {
    const data = await api('GET', '/settings');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('update_settings', 'Update application settings (admin)', {
    settings: z.string().describe('JSON object of settings to update'),
  }, async ({ settings }) => {
    const data = await api('PUT', '/settings', JSON.parse(settings));
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  // ──────────────────────────────────────────
  // Airwallex
  // ──────────────────────────────────────────

  server.tool('get_airwallex_status', 'Get Airwallex sync status, token info, and balance comparison', {}, async () => {
    const data = await api('GET', '/airwallex/status');
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('trigger_airwallex_sync', 'Trigger Airwallex bank sync for an entity', {
    entity: z.string().describe('"ax" for Axilogy or "nt" for Naton'),
  }, async ({ entity }) => {
    const data = await api('POST', `/airwallex/sync/${entity}`);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_airwallex_sync_logs', 'Get recent Airwallex sync logs', {
    limit: z.string().optional(),
  }, async (args) => {
    const data = await api('GET', '/airwallex/sync-logs', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('list_pending_bank_transactions', 'List unmatched bank transactions awaiting review', {
    entity: OptStr,
  }, async (args) => {
    const data = await api('GET', '/airwallex/pending', undefined, args);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('match_pending_transaction', 'Link a pending bank transaction to an existing system transaction', {
    id: ReqStr, transactionId: ReqStr,
  }, async ({ id, transactionId }) => {
    const data = await api('POST', `/airwallex/pending/${id}/match`, { transactionId });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('create_from_pending', 'Create a new system transaction from a pending bank transaction', {
    id: ReqStr, category: ReqStr, description: ReqStr, fund: OptStr,
  }, async ({ id, ...body }) => {
    const data = await api('POST', `/airwallex/pending/${id}/create`, body);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('dismiss_pending', 'Dismiss a pending bank transaction', {
    id: ReqStr, note: OptStr,
  }, async ({ id, note }) => {
    const data = await api('POST', `/airwallex/pending/${id}/dismiss`, { note });
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  });
}
