import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { hkToday, type ClientDto, type InvoiceDto, type QuoteDto } from '@hbk/shared';
import { Invoice, Payment } from '../src/modules/invoices/model.js';
import { PNG, upload, world, type World } from './support/fixtures.js';
import { startHarness, type Harness } from './support/harness.js';

let h: Harness;
let w: World;
let client: ClientDto;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());
beforeEach(async () => {
  await h.reset();
  w = await world(h);
  client = (await h.as(w.admin).post('/clients', { name: 'Acme Ltd', email: 'ap@acme.test' })).body;
});

const today = hkToday();

const quoteInput = (extra: Record<string, unknown> = {}) => ({
  companyId: w.company.id,
  clientId: client.id,
  title: 'Website build',
  issueDate: today,
  lineItems: [
    { description: 'Design', quantity: 1, unitPrice: 600_000 },
    { description: 'Build', quantity: 2, unitPrice: 200_000 },
  ],
  ...extra,
});

const invoiceInput = (extra: Record<string, unknown> = {}) => ({
  companyId: w.company.id,
  clientId: client.id,
  title: 'Consulting',
  issueDate: today,
  lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 100_000 }],
  ...extra,
});

async function ok<T>(test: PromiseLike<{ status: number; body: unknown }>, status = 200): Promise<T> {
  const res = await test;
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body as T;
}

/** A quote written by the admin and taken all the way to accepted. */
async function acceptedQuote(extra: Record<string, unknown> = {}): Promise<QuoteDto> {
  const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput(extra)), 201);
  await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
  await ok(h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`));
  await ok(h.as(w.admin).post(`/quotes/${quote.id}/send`));
  return ok<QuoteDto>(h.as(w.admin).post(`/quotes/${quote.id}/accept`));
}

async function issuedInvoice(extra: Record<string, unknown> = {}): Promise<InvoiceDto> {
  const draft = await ok<InvoiceDto>(h.as(w.bookkeeper).post('/invoices', invoiceInput(extra)), 201);
  return ok<InvoiceDto>(h.as(w.bookkeeper).post(`/invoices/${draft.id}/issue`));
}

const pay = (invoiceId: string, amount: number, extra: Record<string, unknown> = {}) =>
  h.as(w.bookkeeper).post(`/invoices/${invoiceId}/payments`, { amount, date: today, method: 'bank_transfer', ...extra });

describe('clients', () => {
  it('are for the office only', async () => {
    assert.equal((await h.as(w.staff).get('/clients')).status, 403);
    assert.equal((await h.as(w.staff).post('/clients', { name: 'X' })).status, 403);
    assert.equal((await h.as(w.bookkeeper).get('/clients')).status, 200);
  });

  it('names the field that is wrong', async () => {
    const res = await h.as(w.admin).post('/clients', { name: '  ', email: 'not-an-email' });
    assert.equal(res.status, 400);
    assert.equal(res.body.fields.name, 'Enter the client name');
    assert.equal(res.body.fields.email, 'Enter a valid email address');
  });

  it('cannot be deleted once a quote or invoice uses them, only archived', async () => {
    await issuedInvoice();
    const res = await h.as(w.admin).delete(`/clients/${client.id}`);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /used by 1 invoice.*Archive it instead/);

    await ok(h.as(w.admin).post(`/clients/${client.id}/archive`));
    const blocked = await h.as(w.admin).post('/invoices', invoiceInput());
    assert.equal(blocked.status, 400);
    assert.match(blocked.body.fields.clientId, /archived/);

    const unused = await ok<ClientDto>(h.as(w.admin).post('/clients', { name: 'Never used' }), 201);
    assert.equal((await h.as(w.admin).delete(`/clients/${unused.id}`)).status, 204);
  });
});

describe('quotes', () => {
  it('calculates totals on the server and numbers quotes per company', async () => {
    const quote = await ok<QuoteDto>(
      h.as(w.admin).post('/quotes', quoteInput({ discountType: 'percent', discountValue: 10, subtotal: 1, total: 1 })),
      201,
    );
    assert.equal(quote.number, `AX-QUO-${today.slice(0, 4)}-0001`);
    assert.deepEqual([quote.subtotal, quote.discount, quote.total], [1_000_000, 100_000, 900_000]);
    assert.equal(quote.status, 'draft');
    const second = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    assert.equal(second.number, `AX-QUO-${today.slice(0, 4)}-0002`);
  });

  it('splits the total across milestones so the parts add up exactly', async () => {
    const quote = await ok<QuoteDto>(
      h.as(w.admin).post(
        '/quotes',
        quoteInput({
          lineItems: [{ description: 'Work', quantity: 1, unitPrice: 100_001 }],
          paymentSchedule: [
            { label: 'Deposit', percentage: 33.33 },
            { label: 'Midway', percentage: 33.33 },
            { label: 'Final', percentage: 33.34 },
          ],
        }),
      ),
      201,
    );
    const amounts = quote.paymentSchedule.map((milestone) => milestone.amount);
    assert.equal(amounts.reduce((sum, amount) => sum + amount, 0), 100_001);
  });

  it('refuses milestones that do not add up to 100%', async () => {
    const res = await h.as(w.admin).post('/quotes', quoteInput({ paymentSchedule: [{ label: 'Deposit', percentage: 50 }] }));
    assert.equal(res.status, 400);
    assert.match(res.body.fields.paymentSchedule, /add up to 50%/);
  });

  it('cannot be sent without approval', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    const asDraft = await h.as(w.admin).post(`/quotes/${quote.id}/send`);
    assert.equal(asDraft.status, 409);
    assert.match(asDraft.body.error, /only be sent once it is approved/);

    await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
    assert.equal((await h.as(w.admin).post(`/quotes/${quote.id}/send`)).status, 409);

    await ok(h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`));
    const sent = await ok<QuoteDto>(h.as(w.admin).post(`/quotes/${quote.id}/send`));
    assert.equal(sent.status, 'sent');
  });

  it('cannot be approved by the person who wrote it, or by someone who is not an approver', async () => {
    const quote = await ok<QuoteDto>(h.as(w.bookkeeper).post('/quotes', quoteInput()), 201);
    const submitted = await ok<QuoteDto>(h.as(w.bookkeeper).post(`/quotes/${quote.id}/submit`));
    assert.ok(!submitted.actions.includes('approve'));

    const own = await h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`);
    assert.equal(own.status, 403);
    assert.match(own.body.error, /cannot approve your own/);

    const notApprover = await h.as(w.admin).post(`/quotes/${quote.id}/approve`);
    assert.equal(notApprover.status, 403);
    assert.match(notApprover.body.error, /Only the approvers chosen in Settings/);

    const approved = await ok<QuoteDto>(h.as(w.approver).post(`/quotes/${quote.id}/approve`));
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvals[0]!.userName, 'Cy Approver');
  });

  it('counts someone who edited the quote as an author too', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    await ok(h.as(w.bookkeeper).put(`/quotes/${quote.id}`, quoteInput({ title: 'Changed by the bookkeeper' })));
    await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
    assert.equal((await h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`)).status, 403);
    assert.equal((await h.as(w.approver).post(`/quotes/${quote.id}/approve`)).status, 200);
  });

  it('cannot be submitted when no approvers are chosen, or when nobody else could approve it', async () => {
    const quote = await ok<QuoteDto>(h.as(w.bookkeeper).post('/quotes', quoteInput()), 201);

    await ok(h.as(w.admin).put('/settings/approval', { approverIds: [w.bookkeeper.id], approvalsRequired: 1 }));
    const deadEnd = await h.as(w.bookkeeper).post(`/quotes/${quote.id}/submit`);
    assert.equal(deadEnd.status, 409);
    assert.match(deadEnd.body.error, /choose more approvers in Settings/);

    await ok(h.as(w.admin).put('/settings/approval', { approverIds: [], approvalsRequired: 1 }));
    const none = await h.as(w.bookkeeper).post(`/quotes/${quote.id}/submit`);
    assert.equal(none.status, 409);
    assert.match(none.body.error, /No approvers are chosen/);
  });

  it('needs every required approval', async () => {
    await ok(h.as(w.admin).put('/settings/approval', { approverIds: [w.bookkeeper.id, w.approver.id], approvalsRequired: 2 }));
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));

    const first = await ok<QuoteDto>(h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`));
    assert.equal(first.status, 'pending_approval');
    assert.equal((await h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`)).status, 403);
    const second = await ok<QuoteDto>(h.as(w.approver).post(`/quotes/${quote.id}/approve`));
    assert.equal(second.status, 'approved');
  });

  it('goes back to draft with the reason when rejected, and loses its approvals when changed', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
    assert.equal((await h.as(w.bookkeeper).post(`/quotes/${quote.id}/reject`, {})).status, 400);
    const rejected = await ok<QuoteDto>(h.as(w.bookkeeper).post(`/quotes/${quote.id}/reject`, { reason: 'Price too low' }));
    assert.deepEqual([rejected.status, rejected.rejectionReason], ['draft', 'Price too low']);

    await ok(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
    await ok(h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`));
    const locked = await h.as(w.admin).put(`/quotes/${quote.id}`, quoteInput({ title: 'Sneaky change' }));
    assert.equal(locked.status, 409);

    const revised = await ok<QuoteDto>(h.as(w.admin).post(`/quotes/${quote.id}/revise`));
    assert.deepEqual([revised.status, revised.approvals.length], ['draft', 0]);
    await ok(h.as(w.admin).put(`/quotes/${quote.id}`, quoteInput({ title: 'Honest change' })));
    assert.equal((await h.as(w.admin).post(`/quotes/${quote.id}/send`)).status, 409);
  });

  it('emails the approvers on submit and records what really happened to the email', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    const submitted = await ok<QuoteDto>(h.as(w.admin).post(`/quotes/${quote.id}/submit`));
    assert.equal(h.emails.length, 1);
    assert.deepEqual(h.emails[0]!.to.sort(), [w.bookkeeper.email, w.approver.email].sort());
    assert.match(h.emails[0]!.html, new RegExp(`http://web.test/quotes/${quote.id}`));
    assert.equal(submitted.activity.at(-1)!.action, 'Email sent');

    h.failEmails('mailbox unavailable');
    const approved = await ok<QuoteDto>(h.as(w.bookkeeper).post(`/quotes/${quote.id}/approve`));
    assert.equal(approved.status, 'approved', 'a failed email does not undo the approval');
    const last = approved.activity.at(-1)!;
    assert.equal(last.action, 'Email failed');
    assert.match(last.note, /mailbox unavailable/);
  });

  it('is hidden from staff', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    assert.equal((await h.as(w.staff).get('/quotes')).status, 403);
    assert.equal((await h.as(w.staff).get(`/quotes/${quote.id}`)).status, 403);
    assert.equal((await h.as(w.staff).get(`/quotes/${quote.id}/pdf`)).status, 403);
  });
});

describe('turning a quote into an invoice', () => {
  it('needs an accepted quote', async () => {
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    const res = await h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {});
    assert.equal(res.status, 409);
    assert.match(res.body.error, /Only an accepted quote/);
  });

  it('happens once: a second attempt is refused, even when both arrive together', async () => {
    const quote = await acceptedQuote();
    const [a, b] = await Promise.all([
      h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {}),
      h.as(w.bookkeeper).post(`/quotes/${quote.id}/invoices`, {}),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(await Invoice.countDocuments({}), 1);

    const invoice = (a.status === 201 ? a.body : b.body) as InvoiceDto;
    assert.deepEqual([invoice.status, invoice.total, invoice.quote!.number], ['draft', 1_000_000, quote.number]);

    const again = await h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {});
    assert.equal(again.status, 409);
    assert.match(again.body.error, /already been invoiced/);
    const reread = await ok<QuoteDto>(h.as(w.admin).get(`/quotes/${quote.id}`));
    assert.ok(reread.invoice);
    assert.ok(!reread.actions.includes('convert'));
  });

  it('invoices each milestone once, for exactly its share', async () => {
    const quote = await acceptedQuote({
      paymentSchedule: [
        { label: 'Deposit', percentage: 40 },
        { label: 'On delivery', percentage: 60 },
      ],
    });
    const [deposit, delivery] = quote.paymentSchedule;

    const missing = await h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {});
    assert.equal(missing.status, 400);
    assert.ok(missing.body.fields.milestoneId);

    const first = await ok<InvoiceDto>(h.as(w.admin).post(`/quotes/${quote.id}/invoices`, { milestoneId: deposit!.id }), 201);
    assert.deepEqual([first.total, first.milestoneLabel], [400_000, 'Deposit']);
    assert.equal((await h.as(w.admin).post(`/quotes/${quote.id}/invoices`, { milestoneId: deposit!.id })).status, 409);
    const second = await ok<InvoiceDto>(h.as(w.admin).post(`/quotes/${quote.id}/invoices`, { milestoneId: delivery!.id }), 201);
    assert.equal(second.total, 600_000);
  });

  it('can be invoiced again after the invoice is cancelled, and cannot be changed while invoiced', async () => {
    const quote = await acceptedQuote();
    const draft = await ok<InvoiceDto>(h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {}), 201);
    const revise = await h.as(w.admin).post(`/quotes/${quote.id}/revise`);
    assert.equal(revise.status, 409);
    assert.match(revise.body.error, /has been invoiced/);

    await ok(h.as(w.admin).post(`/invoices/${draft.id}/issue`));
    await ok(h.as(w.admin).post(`/invoices/${draft.id}/cancel`, { reason: 'Client changed their mind' }));
    assert.equal((await h.as(w.admin).post(`/quotes/${quote.id}/invoices`, {})).status, 201);
  });
});

describe('invoices', () => {
  it('get their number when issued, so deleted drafts leave no gaps', async () => {
    const draft = await ok<InvoiceDto>(h.as(w.bookkeeper).post('/invoices', invoiceInput()), 201);
    assert.deepEqual([draft.status, draft.number], ['draft', '']);
    assert.equal((await h.as(w.bookkeeper).delete(`/invoices/${draft.id}`)).status, 204);

    const issued = await issuedInvoice();
    assert.deepEqual([issued.status, issued.number], ['unpaid', `AX-INV-${today.slice(0, 4)}-0001`]);
    assert.equal(issued.bankDetails, w.company.bankDetails);
  });

  it('starts numbering from the number set in Settings', async () => {
    await ok(h.as(w.admin).put(`/companies/${w.company.id}/numbering`, { quote: 1, invoice: 250, receipt: 1 }));
    assert.equal((await issuedInvoice()).number, `AX-INV-${today.slice(0, 4)}-0250`);
  });

  it('must total more than zero', async () => {
    const res = await h.as(w.bookkeeper).post('/invoices', invoiceInput({ lineItems: [{ description: 'Free', quantity: 1, unitPrice: 0 }] }));
    assert.equal(res.status, 400);
    assert.equal(res.body.fields.lineItems, 'The total must be above zero');
  });

  it('follows its payments: unpaid, part paid, paid', async () => {
    const invoice = await issuedInvoice();
    const part = await ok<InvoiceDto>(pay(invoice.id, 40_000), 201);
    assert.deepEqual([part.status, part.amountPaid, part.amountDue], ['partial', 40_000, 60_000]);
    assert.equal(part.payments[0]!.number, `AX-REC-${today.slice(0, 4)}-0001`);

    const full = await ok<InvoiceDto>(pay(invoice.id, 60_000), 201);
    assert.deepEqual([full.status, full.amountPaid, full.amountDue, full.payments.length], ['paid', 100_000, 0, 2]);
  });

  it('refuses a payment for more than is owed and says how much is', async () => {
    const invoice = await issuedInvoice();
    await ok(pay(invoice.id, 70_000), 201);
    const over = await pay(invoice.id, 30_001);
    assert.equal(over.status, 400);
    assert.match(over.body.fields.amount, /Only HK\$ 300\.00 is still owed/);
    assert.equal((await h.as(w.bookkeeper).get(`/invoices/${invoice.id}`)).body.amountPaid, 70_000);
  });

  it('never takes more than is owed when payments arrive at the same moment', async () => {
    const invoice = await issuedInvoice();
    const results = await Promise.all([pay(invoice.id, 60_000), pay(invoice.id, 60_000), pay(invoice.id, 60_000)]);
    assert.deepEqual(results.map((res) => res.status).sort(), [201, 400, 400]);
    const after = await ok<InvoiceDto>(h.as(w.bookkeeper).get(`/invoices/${invoice.id}`));
    assert.deepEqual([after.amountPaid, after.status, after.payments.length], [60_000, 'partial', 1]);
    assert.equal(await Payment.countDocuments({}), 1);
  });

  it('refuses a payment on a draft, a cancelled or a paid invoice, or dated in the future', async () => {
    const draft = await ok<InvoiceDto>(h.as(w.bookkeeper).post('/invoices', invoiceInput()), 201);
    assert.match((await pay(draft.id, 1000)).body.error, /Issue this invoice/);

    const invoice = await issuedInvoice();
    const future = await pay(invoice.id, 1000, { date: '2999-01-01' });
    assert.equal(future.body.fields.date, 'A payment cannot be dated in the future');

    await ok(pay(invoice.id, 100_000), 201);
    assert.match((await pay(invoice.id, 1)).body.error, /already paid in full/);
  });

  it('keeps payments when edited, and cannot be edited below what was received', async () => {
    const invoice = await issuedInvoice();
    await ok(pay(invoice.id, 40_000), 201);

    const tooLow = await h.as(w.bookkeeper).put(`/invoices/${invoice.id}`, invoiceInput({ lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 30_000 }] }));
    assert.equal(tooLow.status, 400);
    assert.match(tooLow.body.fields.lineItems, /cannot go below the HK\$ 400\.00 already received/);

    const edited = await ok<InvoiceDto>(
      h.as(w.bookkeeper).put(`/invoices/${invoice.id}`, invoiceInput({ lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 150_000 }] })),
    );
    assert.deepEqual([edited.total, edited.amountPaid, edited.amountDue, edited.status, edited.payments.length], [150_000, 40_000, 110_000, 'partial', 1]);
    assert.equal(edited.number, invoice.number);

    const settled = await ok<InvoiceDto>(
      h.as(w.bookkeeper).put(`/invoices/${invoice.id}`, invoiceInput({ lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 40_000 }] })),
    );
    assert.equal(settled.status, 'paid');
  });

  it('is locked once paid', async () => {
    const invoice = await issuedInvoice();
    const paid = await ok<InvoiceDto>(pay(invoice.id, 100_000), 201);
    assert.deepEqual(paid.actions, []);
    const res = await h.as(w.bookkeeper).put(`/invoices/${invoice.id}`, invoiceInput({ title: 'Changed' }));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /paid and can no longer be changed/);
    assert.equal((await h.as(w.admin).delete(`/invoices/${invoice.id}`)).status, 409);
    assert.equal((await h.as(w.admin).post(`/invoices/${invoice.id}/cancel`, { reason: 'x' })).status, 409);
  });

  it('cannot be deleted once issued; it is cancelled with a reason and keeps its number', async () => {
    const invoice = await issuedInvoice();
    const del = await h.as(w.admin).delete(`/invoices/${invoice.id}`);
    assert.equal(del.status, 409);
    assert.match(del.body.error, /Cancel this invoice instead/);
    assert.equal((await h.as(w.admin).post(`/invoices/${invoice.id}/cancel`, {})).status, 400);

    const cancelled = await ok<InvoiceDto>(h.as(w.admin).post(`/invoices/${invoice.id}/cancel`, { reason: 'Raised in error' }));
    assert.deepEqual([cancelled.status, cancelled.number, cancelled.amountDue], ['cancelled', invoice.number, 0]);
    assert.equal((await issuedInvoice()).number, `AX-INV-${today.slice(0, 4)}-0002`);
  });

  it('cannot be cancelled while it has payments; an admin voids the payment first', async () => {
    const invoice = await issuedInvoice();
    const paid = await ok<InvoiceDto>(pay(invoice.id, 40_000), 201);
    const payment = paid.payments[0]!;

    const blocked = await h.as(w.admin).post(`/invoices/${invoice.id}/cancel`, { reason: 'Mistake' });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.error, /void/);

    assert.equal((await h.as(w.bookkeeper).post(`/payments/${payment.id}/void`, { reason: 'Wrong invoice' })).status, 403);
    assert.equal((await h.as(w.admin).post(`/payments/${payment.id}/void`, {})).status, 400);
    const voided = await ok<InvoiceDto>(h.as(w.admin).post(`/payments/${payment.id}/void`, { reason: '$amountPaid typo' }));
    assert.deepEqual([voided.status, voided.amountPaid], ['unpaid', 0]);
    assert.deepEqual([voided.payments[0]!.voided, voided.payments[0]!.voidReason], [true, '$amountPaid typo']);
    assert.match(voided.activity.at(-1)!.note, /\$amountPaid typo/);
    assert.equal(await Payment.countDocuments({}), 1, 'the payment is kept, marked void');

    assert.equal((await h.as(w.admin).post(`/payments/${payment.id}/void`, { reason: 'again' })).status, 409);
    await ok(h.as(w.admin).post(`/invoices/${invoice.id}/cancel`, { reason: 'Mistake' }));
  });

  it('can take further payments after one is voided, up to what is owed', async () => {
    const invoice = await issuedInvoice();
    const paid = await ok<InvoiceDto>(pay(invoice.id, 100_000), 201);
    const reopened = await ok<InvoiceDto>(h.as(w.admin).post(`/payments/${paid.payments[0]!.id}/void`, { reason: 'Bounced cheque' }));
    assert.equal(reopened.status, 'unpaid');
    const again = await ok<InvoiceDto>(pay(invoice.id, 100_000), 201);
    assert.deepEqual([again.status, again.amountPaid], ['paid', 100_000]);
  });

  it('shows as overdue once the due date has passed', async () => {
    const invoice = await issuedInvoice({ issueDate: '2026-01-05', dueDate: '2026-01-19' });
    assert.equal(invoice.overdue, true);
    const list = await ok<InvoiceDto[]>(h.as(w.bookkeeper).get('/invoices?status=overdue'));
    assert.deepEqual(list.map((row) => row.id), [invoice.id]);
    await ok(pay(invoice.id, 100_000), 201);
    assert.equal((await ok<InvoiceDto[]>(h.as(w.bookkeeper).get('/invoices?status=overdue'))).length, 0);
  });

  it('is hidden from staff, and payments need the right role', async () => {
    const invoice = await issuedInvoice();
    assert.equal((await h.as(w.staff).get('/invoices')).status, 403);
    assert.equal((await h.as(w.staff).get(`/invoices/${invoice.id}`)).status, 403);
    assert.equal((await h.as(w.staff).post(`/invoices/${invoice.id}/payments`, { amount: 1, date: today })).status, 403);
  });
});

describe('PDFs', () => {
  const isPdf = (res: { status: number; headers: Record<string, string>; body: Buffer }) => {
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
  };

  it('produces a quote, an invoice and a receipt, with the company chop and signature', async () => {
    const [logo, chop, signature] = await Promise.all([upload(h, w.admin, 'branding', PNG), upload(h, w.admin, 'branding', PNG), upload(h, w.admin, 'branding', PNG)]);
    await ok(
      h.as(w.admin).put(`/companies/${w.company.id}`, {
        ...w.company,
        brandColor: '#0f766e',
        logoFileId: logo.body.id,
        chopFileId: chop.body.id,
        signatureFileId: signature.body.id,
      }),
    );

    const quote = await acceptedQuote({ paymentSchedule: [{ label: 'All', percentage: 100, dueDescription: 'On signing' }], notes: 'Thanks', terms: 'Net 14' });
    isPdf(await h.as(w.bookkeeper).get(`/quotes/${quote.id}/pdf`).buffer(true).parse(binary));

    const invoice = await issuedInvoice({ dueDate: today, notes: 'Thank you' });
    const paid = await ok<InvoiceDto>(pay(invoice.id, 25_000, { reference: 'FPS 123' }), 201);
    isPdf(await h.as(w.bookkeeper).get(`/invoices/${invoice.id}/pdf`).buffer(true).parse(binary));
    isPdf(await h.as(w.bookkeeper).get(`/payments/${paid.payments[0]!.id}/pdf`).buffer(true).parse(binary));
  });

  it('works before any logo, chop or signature is uploaded, and for a draft', async () => {
    const draft = await ok<InvoiceDto>(h.as(w.bookkeeper).post('/invoices', invoiceInput()), 201);
    isPdf(await h.as(w.bookkeeper).get(`/invoices/${draft.id}/pdf`).buffer(true).parse(binary));
    const quote = await ok<QuoteDto>(h.as(w.admin).post('/quotes', quoteInput()), 201);
    isPdf(await h.as(w.bookkeeper).get(`/quotes/${quote.id}/pdf`).buffer(true).parse(binary));
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function binary(res: any, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
