import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  addMonthsToMonth,
  hkCurrentMonth,
  type CompanyDto,
  type DashboardDto,
  type ExpenseDto,
  type InvoiceDto,
  type OtherIncomeDto,
  type PnlEntryDto,
  type PnlMonthDto,
  type PnlSideDto,
  type PnlYearDto,
} from '@hbk/shared';
import { PNG, upload, world, type World } from './support/fixtures.js';
import { startHarness, type Harness } from './support/harness.js';

let h: Harness;
let w: World;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());

const thisMonth = hkCurrentMonth();
const lastMonth = addMonthsToMonth(thisMonth, -1);
// Days that are never in the future, whatever day the tests run on.
const earlier = (day: string) => `${lastMonth}-${day}`;
const first = `${thisMonth}-01`;

async function ok<T>(test: PromiseLike<{ status: number; body: unknown }>, status = 200): Promise<T> {
  const res = await test;
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body as T;
}

let clientId: string;
let payeeId: string;
const ids: Record<string, string> = {};

async function invoice(issueDate: string, amount: number, extra: Record<string, unknown> = {}, issue = true): Promise<InvoiceDto> {
  const draft = await ok<InvoiceDto>(
    h.as(w.bookkeeper).post('/invoices', {
      companyId: w.company.id,
      clientId,
      title: 'Work',
      issueDate,
      lineItems: [{ description: 'Work', quantity: 1, unitPrice: amount }],
      ...extra,
    }),
    201,
  );
  return issue ? ok<InvoiceDto>(h.as(w.bookkeeper).post(`/invoices/${draft.id}/issue`)) : draft;
}

const payInvoice = (invoiceId: string, amount: number, date: string) =>
  ok<{ payments: { id: string }[] }>(h.as(w.bookkeeper).post(`/invoices/${invoiceId}/payments`, { amount, date, method: 'bank_transfer' }), 201);

async function expense(expenseDate: string, items: [string, number][], upTo: 'draft' | 'pending' | 'approved' | 'paid', paidDate = first): Promise<ExpenseDto> {
  const created = await ok<ExpenseDto>(
    h.as(w.admin).post('/expenses', {
      companyId: w.company.id,
      title: 'Bill',
      payeeId,
      expenseDate,
      items: items.map(([category, amount]) => ({ description: category, categoryId: w.category('expense', category), amount })),
    }),
    201,
  );
  if (upTo === 'draft') return created;
  await ok(h.as(w.admin).post(`/expenses/${created.id}/submit`));
  if (upTo === 'pending') return created;
  await ok(h.as(w.bookkeeper).post(`/expenses/${created.id}/approve`));
  if (upTo === 'approved') return created;
  return ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${created.id}/pay`, { paidDate }));
}

/**
 * One office with a little of everything, spread over last month and this month:
 *
 *   Invoice A  issued last month 1,000.00; paid 400.00 last month and 600.00 this month
 *   Invoice F  issued last month 90.00, due last month, unpaid (overdue)
 *   Invoice B  issued this month 2,500.00, unpaid; one 100.00 payment that was voided
 *   A draft and a cancelled invoice, which count nowhere
 *   Bank interest 50.00 received last month
 *   Expense E1 dated last month: Rent 300.00 + Utilities 20.00, paid this month
 *   Expense E2 dated this month: Rent 70.00, approved, not paid
 *   Expense E3 dated this month: waiting for approval (counts nowhere)
 *   Expense E4 dated this month: paid, then reversed (counts nowhere)
 *   A claim: Meals 15.00 last month + Travel 5.00 this month, paid this month
 */
beforeEach(async () => {
  await h.reset();
  w = await world(h);
  clientId = (await ok<{ id: string }>(h.as(w.admin).post('/clients', { name: 'Acme Ltd' }), 201)).id;
  payeeId = (await ok<{ id: string }>(h.as(w.admin).post('/payees', { name: 'Landlord' }), 201)).id;

  const a = await invoice(earlier('10'), 100_000);
  await payInvoice(a.id, 40_000, earlier('20'));
  await payInvoice(a.id, 60_000, first);
  ids.a = a.id;

  ids.f = (await invoice(earlier('10'), 9_000, { dueDate: earlier('12') })).id;

  const b = await invoice(first, 250_000);
  const withPayment = await payInvoice(b.id, 10_000, first);
  await ok(h.as(w.admin).post(`/payments/${withPayment.payments[0].id}/void`, { reason: 'Entered on the wrong invoice' }));
  ids.b = b.id;

  await invoice(first, 77_700, {}, false);
  const cancelled = await invoice(first, 88_800);
  await ok(h.as(w.bookkeeper).post(`/invoices/${cancelled.id}/cancel`, { reason: 'Raised by mistake' }));

  await ok(
    h.as(w.bookkeeper).post('/other-income', {
      companyId: w.company.id,
      date: earlier('15'),
      description: 'Savings interest',
      categoryId: w.category('income', 'Bank interest'),
      amount: 5_000,
    }),
    201,
  );

  ids.e1 = (await expense(earlier('05'), [['Rent', 30_000], ['Utilities', 2_000]], 'paid')).id;
  ids.e2 = (await expense(first, [['Rent', 7_000]], 'approved')).id;
  ids.e3 = (await expense(first, [['Rent', 55_500]], 'pending')).id;
  const e4 = await expense(first, [['Rent', 66_600]], 'paid');
  await ok(h.as(w.admin).post(`/expenses/${e4.id}/reverse`, { reason: 'Paid twice' }));

  const receipt = async () => (await upload(h, w.staff, 'receipt', PNG)).body.id as string;
  const claim = await ok<ExpenseDto>(
    h.as(w.staff).post('/claims', {
      companyId: w.company.id,
      title: 'Client visit',
      items: [
        { date: earlier('28'), description: 'Lunch', categoryId: w.category('expense', 'Meals and entertainment'), amount: 1_500, receiptFileId: await receipt() },
        { date: first, description: 'Taxi', categoryId: w.category('expense', 'Travel and transport'), amount: 500, receiptFileId: await receipt() },
      ],
    }),
    201,
  );
  await ok(h.as(w.staff).post(`/claims/${claim.id}/submit`));
  await ok(h.as(w.bookkeeper).post(`/claims/${claim.id}/approve`));
  await ok(h.as(w.bookkeeper).post(`/claims/${claim.id}/pay`, { paidDate: first }));
  ids.claim = claim.id;
});

const lines = (side: PnlSideDto['income']) => Object.fromEntries(side.map((line) => [line.name, line.amount]));

describe('monthly P&L', () => {
  it('counts cash by the day money moved', async () => {
    const last = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${lastMonth}`));
    assert.deepEqual(lines(last.cash.income), { Sales: 40_000, 'Bank interest': 5_000 });
    assert.deepEqual(lines(last.cash.expenses), {});
    assert.deepEqual([last.cash.totalIncome, last.cash.totalExpenses, last.cash.net], [45_000, 0, 45_000]);

    const now = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}`));
    // The voided payment, the reversed expense and the unpaid expense are not here.
    assert.deepEqual(lines(now.cash.income), { Sales: 60_000 });
    assert.deepEqual(lines(now.cash.expenses), { Rent: 30_000, Utilities: 2_000, 'Travel and transport': 500, 'Meals and entertainment': 1_500 });
    assert.deepEqual([now.cash.totalIncome, now.cash.totalExpenses, now.cash.net], [60_000, 34_000, 26_000]);
  });

  it('counts billed and committed by the date on the document', async () => {
    const last = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${lastMonth}`));
    assert.deepEqual(lines(last.billed.income), { Sales: 109_000, 'Bank interest': 5_000 });
    // The claim is split: only the receipt dated last month counts here.
    assert.deepEqual(lines(last.billed.expenses), { Rent: 30_000, Utilities: 2_000, 'Meals and entertainment': 1_500 });
    assert.deepEqual([last.billed.totalIncome, last.billed.totalExpenses, last.billed.net], [114_000, 33_500, 80_500]);

    const now = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}`));
    // The draft and cancelled invoices and the expense still waiting for approval are not here.
    assert.deepEqual(lines(now.billed.income), { Sales: 250_000 });
    assert.deepEqual(lines(now.billed.expenses), { Rent: 7_000, 'Travel and transport': 500 });
    assert.equal(now.billed.net, 242_500);
  });

  it('shows exactly the items behind every figure', async () => {
    for (const month of [lastMonth, thisMonth]) {
      const pnl = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${month}`));
      for (const basis of ['cash', 'billed'] as const) {
        for (const [side, list, total] of [
          ['income', pnl[basis].income, pnl[basis].totalIncome],
          ['expense', pnl[basis].expenses, pnl[basis].totalExpenses],
        ] as const) {
          for (const line of list) {
            const entries = await ok<PnlEntryDto[]>(
              h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${month}&basis=${basis}&side=${side}&categoryId=${line.categoryId}`),
            );
            assert.ok(entries.length > 0);
            assert.equal(entries.reduce((sum, entry) => sum + entry.amount, 0), line.amount, `${month} ${basis} ${line.name}`);
          }
          const all = await ok<PnlEntryDto[]>(h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${month}&basis=${basis}&side=${side}`));
          assert.equal(all.reduce((sum, entry) => sum + entry.amount, 0), total);
        }
      }
    }
  });

  it('names the record each item came from', async () => {
    const rent = w.category('expense', 'Rent');
    const paidRent = await ok<PnlEntryDto[]>(h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${thisMonth}&basis=cash&side=expense&categoryId=${rent}`));
    assert.deepEqual(paidRent.map((entry) => [entry.source, entry.documentId, entry.counterparty, entry.amount, entry.date]), [['expense', ids.e1, 'Landlord', 30_000, first]]);

    const sales = w.categories.find((category) => category.system === 'sales')!.id;
    const received = await ok<PnlEntryDto[]>(h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${lastMonth}&basis=cash&side=income&categoryId=${sales}`));
    assert.equal(received.length, 1);
    assert.equal(received[0].source, 'payment');
    assert.equal(received[0].documentId, ids.a);
    assert.equal(received[0].counterparty, 'Acme Ltd');
    assert.match(received[0].number, /^AX-REC-/);

    const meals = w.category('expense', 'Meals and entertainment');
    const claimed = await ok<PnlEntryDto[]>(h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${lastMonth}&basis=billed&side=expense&categoryId=${meals}`));
    assert.deepEqual(claimed.map((entry) => [entry.source, entry.documentId, entry.counterparty, entry.description]), [['claim', ids.claim, 'Sia Staff', 'Lunch']]);
  });

  it('adds the months up to the year', async () => {
    const year = Number(thisMonth.slice(0, 4));
    const pnl = await ok<PnlYearDto>(h.as(w.bookkeeper).get(`/reports/pnl/year?year=${year}`));
    assert.equal(pnl.months.length, 12);
    const row = pnl.months.find((month) => month.month === thisMonth)!;
    assert.deepEqual(row.cash, { income: 60_000, expenses: 34_000, net: 26_000 });
    assert.deepEqual(row.billed, { income: 250_000, expenses: 7_500, net: 242_500 });
    for (const basis of ['cash', 'billed'] as const) {
      for (const key of ['income', 'expenses', 'net'] as const) {
        assert.equal(pnl.months.reduce((sum, month) => sum + month[basis][key], 0), pnl[basis][key]);
      }
    }
    if (lastMonth.startsWith(String(year))) {
      assert.deepEqual(pnl.cash, { income: 105_000, expenses: 34_000, net: 71_000 });
      assert.deepEqual(pnl.billed, { income: 364_000, expenses: 41_000, net: 323_000 });
    }
  });

  it('can be narrowed to one company', async () => {
    const second = await ok<CompanyDto>(h.as(w.admin).post('/companies', { code: 'NL', name: 'Naton Lab Limited' }), 201);
    await ok(
      h.as(w.bookkeeper).post('/other-income', {
        companyId: second.id,
        date: first,
        description: 'Grant',
        categoryId: w.category('income', 'Other income'),
        amount: 123_400,
      }),
      201,
    );
    const both = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}`));
    assert.equal(both.cash.totalIncome, 60_000 + 123_400);
    const onlySecond = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}&companyId=${second.id}`));
    assert.deepEqual([onlySecond.cash.totalIncome, onlySecond.cash.totalExpenses, onlySecond.billed.totalIncome], [123_400, 0, 123_400]);
    const onlyFirst = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}&companyId=${w.company.id}`));
    assert.equal(onlyFirst.cash.totalIncome, 60_000);
  });

  it('is for the office only and refuses a month that is not one', async () => {
    assert.equal((await h.as(w.staff).get(`/reports/pnl?month=${thisMonth}`)).status, 403);
    assert.equal((await h.as(w.staff).get(`/reports/pnl/entries?month=${thisMonth}&basis=cash&side=income`)).status, 403);
    assert.equal((await h.as(w.staff).get('/reports/pnl/year')).status, 403);
    assert.equal((await h.as(w.staff).get('/dashboard')).status, 403);
    assert.equal((await h.as(w.bookkeeper).get('/reports/pnl?month=2026-13')).status, 400);
    assert.equal((await h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${thisMonth}&basis=accrual&side=income`)).status, 400);
  });
});

describe('other income', () => {
  const input = (extra: Record<string, unknown> = {}) => ({
    companyId: w.company.id,
    date: first,
    description: 'Refund from supplier',
    categoryId: w.category('income', 'Other income'),
    amount: 12_345,
    ...extra,
  });

  it('is entered, changed and removed by the office, and the P&L follows', async () => {
    assert.equal((await h.as(w.staff).get('/other-income')).status, 403);
    assert.equal((await h.as(w.staff).post('/other-income', input())).status, 403);

    const entry = await ok<OtherIncomeDto>(h.as(w.bookkeeper).post('/other-income', input()), 201);
    assert.equal(entry.categoryName, 'Other income');
    const income = async () => (await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${thisMonth}`))).cash.totalIncome;
    assert.equal(await income(), 60_000 + 12_345);

    await ok(h.as(w.bookkeeper).put(`/other-income/${entry.id}`, input({ amount: 20_000 })));
    assert.equal(await income(), 80_000);

    assert.equal((await h.as(w.bookkeeper).delete(`/other-income/${entry.id}`)).status, 204);
    assert.equal(await income(), 60_000);
  });

  it('must use an income category that is not Sales, and a date that has happened', async () => {
    const sales = w.categories.find((category) => category.system === 'sales')!.id;
    const asSales = await h.as(w.bookkeeper).post('/other-income', input({ categoryId: sales }));
    assert.equal(asSales.status, 400);
    assert.match(asSales.body.fields.categoryId, /invoices/);
    const asExpense = await h.as(w.bookkeeper).post('/other-income', input({ categoryId: w.category('expense') }));
    assert.match(asExpense.body.fields.categoryId, /income category/);
    const future = await h.as(w.bookkeeper).post('/other-income', input({ date: '2999-01-01' }));
    assert.ok(future.body.fields.date);
    const nothing = await h.as(w.bookkeeper).post('/other-income', input({ amount: 0 }));
    assert.ok(nothing.body.fields.amount);
  });
});

describe('dashboard', () => {
  it('shows this month, what is owed, and what is waiting', async () => {
    const dashboard = await ok<DashboardDto>(h.as(w.bookkeeper).get('/dashboard'));
    assert.equal(dashboard.month, thisMonth);
    assert.deepEqual(dashboard.cash, { income: 60_000, expenses: 34_000, net: 26_000 });
    assert.deepEqual(dashboard.billed, { income: 250_000, expenses: 7_500, net: 242_500 });

    assert.equal(dashboard.unpaidInvoices.count, 2);
    assert.equal(dashboard.unpaidInvoices.total, 259_000);
    assert.equal(dashboard.unpaidInvoices.overdueCount, 1);
    assert.equal(dashboard.unpaidInvoices.overdueTotal, 9_000);
    assert.deepEqual(dashboard.unpaidInvoices.items.map((item) => [item.id, item.overdue]), [
      [ids.f, true],
      [ids.b, false],
    ]);

    assert.deepEqual(dashboard.waitingForApproval.map((item) => [item.kind, item.id, item.mine]), [['expense', ids.e3, true]]);
    assert.deepEqual(dashboard.waitingForPayment.map((item) => item.id), [ids.e2]);
    assert.deepEqual(dashboard.setup, { hasCompany: true, hasApprovers: true });
  });

  it('marks only what this person can approve as theirs', async () => {
    // The admin wrote the expense and is not an approver.
    const forAdmin = await ok<DashboardDto>(h.as(w.admin).get('/dashboard'));
    assert.deepEqual(forAdmin.waitingForApproval.map((item) => item.mine), [false]);

    const quote = await ok<{ id: string }>(
      h.as(w.bookkeeper).post('/quotes', {
        companyId: w.company.id,
        clientId,
        title: 'Retainer',
        issueDate: first,
        lineItems: [{ description: 'Retainer', quantity: 1, unitPrice: 500_000 }],
      }),
      201,
    );
    await ok(h.as(w.bookkeeper).post(`/quotes/${quote.id}/submit`));
    const forAuthor = await ok<DashboardDto>(h.as(w.bookkeeper).get('/dashboard'));
    assert.deepEqual(forAuthor.waitingForApproval.map((item) => [item.kind, item.mine]), [
      ['quote', false],
      ['expense', true],
    ]);
  });

  it('says what still has to be set up in an empty office', async () => {
    await h.reset();
    const admin = await h.user('admin');
    const dashboard = await ok<DashboardDto>(h.as(admin).get('/dashboard'));
    assert.deepEqual(dashboard.setup, { hasCompany: false, hasApprovers: false });
    assert.deepEqual(dashboard.cash, { income: 0, expenses: 0, net: 0 });
    assert.equal(dashboard.unpaidInvoices.count, 0);
  });
});
