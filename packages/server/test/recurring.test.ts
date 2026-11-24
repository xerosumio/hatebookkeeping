import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  addDays,
  addMonthsToMonth,
  hkCurrentMonth,
  type DashboardDto,
  type ExpenseDto,
  type GenerateResultDto,
  type InvoiceDto,
  type RecurringDto,
} from '@hbk/shared';
import { sendRecurringReminders } from '../src/modules/recurring/service.js';
import { world, type World } from './support/fixtures.js';
import { startHarness, type Harness } from './support/harness.js';

let h: Harness;
let w: World;
let clientId: string;
let payeeId: string;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());
beforeEach(async () => {
  await h.reset();
  w = await world(h);
  clientId = (await ok<{ id: string }>(h.as(w.admin).post('/clients', { name: 'Acme Ltd' }), 201)).id;
  payeeId = (await ok<{ id: string }>(h.as(w.admin).post('/payees', { name: 'Landlord' }), 201)).id;
});

async function ok<T>(test: PromiseLike<{ status: number; body: unknown }>, status = 200): Promise<T> {
  const res = await test;
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body as T;
}

const thisMonth = hkCurrentMonth();
const lastMonth = addMonthsToMonth(thisMonth, -1);
/** Due on the 1st with no advance notice, so the 1st of this month is always the period waiting. */
const firstOfMonth = `${thisMonth}-01`;

const invoiceItem = (extra: Record<string, unknown> = {}) => ({
  kind: 'invoice',
  name: 'Acme retainer',
  companyId: w.company.id,
  clientId,
  description: 'Monthly retainer',
  amount: 800_000,
  frequency: 'monthly',
  startDate: firstOfMonth,
  dayOfMonth: 1,
  remindDaysBefore: 0,
  paymentTermsDays: 14,
  ...extra,
});

const expenseItem = (extra: Record<string, unknown> = {}) => ({
  kind: 'expense',
  name: 'Office rent',
  companyId: w.company.id,
  payeeId,
  categoryId: w.category('expense', 'Rent'),
  amount: 1_500_000,
  frequency: 'monthly',
  startDate: firstOfMonth,
  dayOfMonth: 1,
  remindDaysBefore: 0,
  ...extra,
});

const add = (input: Record<string, unknown>) => ok<RecurringDto>(h.as(w.bookkeeper).post('/recurring', input), 201);

describe('recurring items', () => {
  it('need a client for an invoice, a payee and category for an expense, and a start date', async () => {
    const noClient = await h.as(w.bookkeeper).post('/recurring', invoiceItem({ clientId: '' }));
    assert.equal(noClient.status, 400);
    assert.equal(noClient.body.fields.clientId, 'Choose a client');

    const noPayee = await h.as(w.bookkeeper).post('/recurring', expenseItem({ payeeId: null, categoryId: null }));
    assert.equal(noPayee.status, 400);
    assert.equal(noPayee.body.fields.payeeId, 'Choose a payee');
    assert.equal(noPayee.body.fields.categoryId, 'Choose a category');

    const noStart = await h.as(w.bookkeeper).post('/recurring', invoiceItem({ startDate: '' }));
    assert.equal(noStart.status, 400);
    assert.ok(noStart.body.fields.startDate);

    const bad = await h.as(w.bookkeeper).post('/recurring', invoiceItem({ amount: 0, dayOfMonth: 31, frequency: 'weekly' }));
    for (const field of ['amount', 'dayOfMonth', 'frequency']) assert.ok(bad.body.fields[field], field);
    const endsFirst = await h.as(w.bookkeeper).post('/recurring', invoiceItem({ endDate: addDays(firstOfMonth, -1) }));
    assert.match(endsFirst.body.fields.endDate, /before the start date/);

    const missingClient = await h.as(w.bookkeeper).post('/recurring', invoiceItem({ clientId: payeeId }));
    assert.equal(missingClient.body.fields.clientId, 'Choose a client');
    const incomeCategory = await h.as(w.bookkeeper).post('/recurring', expenseItem({ categoryId: w.category('income') }));
    assert.match(incomeCategory.body.fields.categoryId, /expense category/);
  });

  it('are for the office only', async () => {
    const item = await add(invoiceItem());
    assert.equal((await h.as(w.staff).get('/recurring')).status, 403);
    assert.equal((await h.as(w.staff).post('/recurring', invoiceItem())).status, 403);
    assert.equal((await h.as(w.staff).post(`/recurring/${item.id}/generate`, { period: firstOfMonth })).status, 403);
    assert.equal((await h.as(w.staff).post('/recurring/generate-due')).status, 403);
  });

  it('show what is waiting, and stay waiting until generated or skipped', async () => {
    const item = await add(invoiceItem({ startDate: `${lastMonth}-01` }));
    assert.equal(item.state, 'overdue');
    assert.deepEqual(item.pending, [`${lastMonth}-01`, firstOfMonth]);
    assert.equal(item.client?.name, 'Acme Ltd');
    assert.equal(item.payee, null);

    const dashboard = await ok<DashboardDto>(h.as(w.bookkeeper).get('/dashboard'));
    assert.deepEqual(dashboard.recurringDue.map((due) => [due.name, due.period]), [['Acme retainer', `${lastMonth}-01`]]);

    const skipped = await ok<RecurringDto>(h.as(w.bookkeeper).post(`/recurring/${item.id}/skip`, { period: `${lastMonth}-01` }));
    assert.deepEqual(skipped.pending, [firstOfMonth]);
    assert.deepEqual(skipped.history.map((entry) => [entry.period, entry.action, entry.document]), [[`${lastMonth}-01`, 'skipped', null]]);
    assert.equal((await h.as(w.bookkeeper).post(`/recurring/${item.id}/skip`, { period: `${lastMonth}-01` })).status, 409);
  });

  it('generate a draft invoice with the right client, amount and dates', async () => {
    const item = await add(invoiceItem());
    const res = await ok<{ document: { kind: string; id: string }; item: RecurringDto }>(
      h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth }),
      201,
    );
    assert.equal(res.document.kind, 'invoice');
    assert.deepEqual(res.item.pending, []);
    assert.equal(res.item.history[0].document?.id, res.document.id);

    const invoice = await ok<InvoiceDto>(h.as(w.bookkeeper).get(`/invoices/${res.document.id}`));
    assert.equal(invoice.status, 'draft');
    assert.equal(invoice.client.id, clientId);
    assert.equal(invoice.total, 800_000);
    assert.equal(invoice.issueDate, firstOfMonth);
    assert.equal(invoice.dueDate, addDays(firstOfMonth, 14));
    assert.equal(invoice.lineItems[0].description, 'Monthly retainer');
    // A draft is not income until someone issues it.
    assert.equal((await ok<DashboardDto>(h.as(w.bookkeeper).get('/dashboard'))).billed.income, 0);
  });

  it('generate a draft expense that still needs approval by someone else', async () => {
    const item = await add(expenseItem());
    const res = await ok<{ document: { id: string } }>(h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth }), 201);
    const expense = await ok<ExpenseDto>(h.as(w.bookkeeper).get(`/expenses/${res.document.id}`));
    assert.equal(expense.status, 'draft');
    assert.equal(expense.payee?.id, payeeId);
    assert.equal(expense.total, 1_500_000);
    assert.equal(expense.items[0].categoryName, 'Rent');
    assert.equal(expense.expenseDate, firstOfMonth);

    await ok(h.as(w.bookkeeper).post(`/expenses/${expense.id}/submit`));
    // The person who generated it is its author and cannot approve it.
    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`)).status, 403);
    await ok(h.as(w.approver).post(`/expenses/${expense.id}/approve`));
  });

  it('generate once per period, however many times it is asked', async () => {
    const item = await add(invoiceItem());
    const both = await Promise.all([
      h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth }),
      h.as(w.admin).post(`/recurring/${item.id}/generate`, { period: firstOfMonth }),
    ]);
    assert.deepEqual(both.map((res) => res.status).sort(), [201, 409]);
    const again = await h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth });
    assert.equal(again.status, 409);
    assert.match(again.body.error, /already been generated or skipped/);
    assert.equal((await ok<InvoiceDto[]>(h.as(w.bookkeeper).get('/invoices'))).length, 1);

    // Moving the day of the month does not make the same month come due again.
    const moved = await ok<RecurringDto>(h.as(w.bookkeeper).put(`/recurring/${item.id}`, invoiceItem({ dayOfMonth: 1, startDate: `${lastMonth}-28` })));
    assert.deepEqual(moved.pending, []);
  });

  it('refuse a period that is not due, and anything while paused', async () => {
    const item = await add(invoiceItem());
    const early = await h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: `${addMonthsToMonth(thisMonth, 3)}-01` });
    assert.equal(early.status, 409);
    assert.match(early.body.error, /not due yet/);

    const paused = await ok<RecurringDto>(h.as(w.bookkeeper).put(`/recurring/${item.id}`, invoiceItem({ active: false })));
    assert.equal(paused.state, 'paused');
    assert.equal((await h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth })).status, 409);
    assert.deepEqual(await ok<GenerateResultDto[]>(h.as(w.bookkeeper).post('/recurring/generate-due')), []);
  });

  it('carry on with the others when one item fails', async () => {
    const otherClient = (await ok<{ id: string }>(h.as(w.admin).post('/clients', { name: 'Gone Ltd' }), 201)).id;
    const broken = await add(invoiceItem({ name: 'Broken retainer', clientId: otherClient }));
    await add(invoiceItem());
    await add(expenseItem());
    await ok(h.as(w.admin).post(`/clients/${otherClient}/archive`));

    const results = await ok<GenerateResultDto[]>(h.as(w.bookkeeper).post('/recurring/generate-due'));
    assert.deepEqual(results.map((result) => [result.name, result.ok]), [
      ['Acme retainer', true],
      ['Broken retainer', false],
      ['Office rent', true],
    ]);
    const failure = results[1];
    assert.match(failure.message, /archived/);
    assert.equal(failure.document, null);
    assert.equal((await ok<InvoiceDto[]>(h.as(w.bookkeeper).get('/invoices'))).length, 1);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.bookkeeper).get('/expenses'))).length, 1);

    // The failed one is still waiting, and works once the cause is fixed. The others are not repeated.
    const list = await ok<RecurringDto[]>(h.as(w.bookkeeper).get('/recurring'));
    assert.deepEqual(list.find((item) => item.id === broken.id)?.pending, [firstOfMonth]);
    await ok(h.as(w.admin).post(`/clients/${otherClient}/restore`));
    const retry = await ok<GenerateResultDto[]>(h.as(w.bookkeeper).post('/recurring/generate-due'));
    assert.deepEqual(retry.map((result) => [result.name, result.ok]), [['Broken retainer', true]]);
    assert.deepEqual(await ok<GenerateResultDto[]>(h.as(w.bookkeeper).post('/recurring/generate-due')), []);
  });

  it('keep their client and payee from being deleted, and leave what they made when removed', async () => {
    const item = await add(invoiceItem());
    await add(expenseItem());
    const client = await h.as(w.admin).delete(`/clients/${clientId}`);
    assert.equal(client.status, 409);
    assert.match(client.body.error, /1 recurring item/);
    assert.equal((await h.as(w.admin).delete(`/payees/${payeeId}`)).status, 409);

    await ok(h.as(w.bookkeeper).post(`/recurring/${item.id}/generate`, { period: firstOfMonth }), 201);
    assert.equal((await h.as(w.bookkeeper).delete(`/recurring/${item.id}`)).status, 204);
    assert.equal((await ok<InvoiceDto[]>(h.as(w.bookkeeper).get('/invoices'))).length, 1);
    assert.equal((await ok<RecurringDto[]>(h.as(w.bookkeeper).get('/recurring'))).length, 1);
  });
});

describe('recurring reminders', () => {
  const scheduled = () => add(invoiceItem({ startDate: '2030-01-10', dayOfMonth: 10, remindDaysBefore: 7 }));
  const item = async () => (await ok<RecurringDto[]>(h.as(w.bookkeeper).get('/recurring')))[0];

  it('are sent once when a period comes due and once more when it is overdue', async () => {
    await scheduled();
    assert.equal((await sendRecurringReminders('2030-01-02')).count, 0);
    assert.equal(h.emails.length, 0);

    const first = await sendRecurringReminders('2030-01-03');
    assert.equal(first.count, 1);
    assert.equal(first.result?.status, 'sent');
    assert.equal(h.emails.length, 1);
    assert.equal(h.emails[0].subject, '1 recurring item is due');
    // The office is told; staff are not.
    assert.deepEqual([...h.emails[0].to].sort(), [w.admin.email, w.bookkeeper.email, w.approver.email].sort());
    assert.match(h.emails[0].html, /Acme retainer/);
    assert.match(h.emails[0].html, /Invoice to Acme Ltd/);

    assert.equal((await sendRecurringReminders('2030-01-03')).count, 0);
    assert.equal((await sendRecurringReminders('2030-01-10')).count, 0);
    assert.equal(h.emails.length, 1);

    const overdue = await sendRecurringReminders('2030-01-11');
    assert.equal(overdue.count, 1);
    assert.equal(h.emails[1].subject, '1 recurring item is due (1 overdue)');
    assert.equal((await sendRecurringReminders('2030-01-20')).count, 0);
    assert.equal(h.emails.length, 2);
  });

  it('record a failed email as failed and try again the next day', async () => {
    await scheduled();
    h.failEmails('mailbox unavailable');
    const failed = await sendRecurringReminders('2030-01-03');
    assert.equal(failed.result?.status, 'failed');
    const afterFailure = await item();
    assert.equal(afterFailure.lastReminder?.status, 'failed');
    assert.equal(afterFailure.lastReminder?.period, '2030-01-10');
    assert.match(afterFailure.lastReminder!.detail, /mailbox unavailable/);

    h.failEmails(null);
    const retried = await sendRecurringReminders('2030-01-04');
    assert.equal(retried.count, 1);
    assert.equal((await item()).lastReminder?.status, 'sent');
    assert.equal((await sendRecurringReminders('2030-01-05')).count, 0);
  });

  it('say so when email is not set up, and stop once the period is dealt with', async () => {
    const created = await scheduled();
    h.disableEmails();
    await sendRecurringReminders('2030-01-03');
    assert.equal((await item()).lastReminder?.status, 'not_configured');

    // Paused items are left alone.
    await ok(h.as(w.bookkeeper).put(`/recurring/${created.id}`, invoiceItem({ startDate: '2030-01-10', dayOfMonth: 10, remindDaysBefore: 7, active: false })));
    assert.equal((await sendRecurringReminders('2030-01-12')).count, 0);
  });
});
