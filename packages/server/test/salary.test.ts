import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { addMonthsToMonth, hkCurrentMonth, hkToday, lastDayOfMonth, type CompanyDto, type ExpenseDto, type PnlEntryDto, type PnlMonthDto, type StaffDto } from '@hbk/shared';
import { world, type World } from './support/fixtures.js';
import { startHarness, type Harness } from './support/harness.js';

let h: Harness;
let w: World;
let amy: StaffDto;
let ben: StaffDto;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());

const today = hkToday();
const lastMonth = addMonthsToMonth(hkCurrentMonth(), -1);

async function ok<T>(test: PromiseLike<{ status: number; body: unknown }>, status = 200): Promise<T> {
  const res = await test;
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body as T;
}

const staffInput = (name: string, monthlySalary: number, extra: Record<string, unknown> = {}) => ({ companyId: w.company.id, name, monthlySalary, ...extra });

beforeEach(async () => {
  await h.reset();
  w = await world(h);
  amy = await ok<StaffDto>(h.as(w.admin).post('/salary/staff', staffInput('Amy Chan', 3_000_000, { fpsId: '9123' })), 201);
  ben = await ok<StaffDto>(h.as(w.admin).post('/salary/staff', staffInput('Ben Lee', 2_500_050)), 201);
});

const startRun = (month = lastMonth, companyId = w.company.id) => h.as(w.admin).post('/salary/runs', { companyId, month });
const linesOf = (run: ExpenseDto) => run.items.map((item) => ({ staffId: item.staffId!, amount: item.amount, note: item.note }));

describe('staff list', () => {
  it('is for the office only, because it holds salaries and bank details', async () => {
    assert.equal((await h.as(w.staff).get('/salary/staff')).status, 403);
    assert.equal((await h.as(w.staff).post('/salary/staff', staffInput('Me', 100))).status, 403);
    assert.equal((await h.as(w.staff).get('/salary/runs')).status, 403);
    const list = await ok<StaffDto[]>(h.as(w.bookkeeper).get('/salary/staff'));
    assert.deepEqual(list.map((member) => [member.name, member.monthlySalary]), [
      ['Amy Chan', 3_000_000],
      ['Ben Lee', 2_500_050],
    ]);
  });

  it('needs a name and a salary above zero', async () => {
    const res = await h.as(w.admin).post('/salary/staff', staffInput(' ', 0));
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.name);
    assert.ok(res.body.fields.monthlySalary);
  });

  it('keeps someone who has been paid; they can only be switched off', async () => {
    await ok(startRun(), 201);
    const res = await h.as(w.admin).delete(`/salary/staff/${amy.id}`);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /1 salary run.*Switch them off/);

    const off = await ok<StaffDto>(h.as(w.admin).put(`/salary/staff/${amy.id}`, staffInput('Amy Chan', 3_000_000, { active: false })));
    assert.equal(off.active, false);

    const cara = await ok<StaffDto>(h.as(w.admin).post('/salary/staff', staffInput('Cara Ho', 100)), 201);
    assert.equal((await h.as(w.admin).delete(`/salary/staff/${cara.id}`)).status, 204);
  });
});

describe('salary runs', () => {
  it('start with a line for each active staff member at their monthly salary', async () => {
    await ok(h.as(w.admin).put(`/salary/staff/${ben.id}`, staffInput('Ben Lee', 2_500_050, { active: false })));
    const run = await ok<ExpenseDto>(startRun(), 201);
    assert.equal(run.kind, 'salary');
    assert.match(run.number, /^SAL-\d{4}-0001$/);
    assert.equal(run.salaryMonth, lastMonth);
    assert.equal(run.status, 'draft');
    assert.deepEqual(run.items.map((item) => [item.description, item.amount, item.categoryName, item.date]), [['Amy Chan', 3_000_000, 'Salary', lastDayOfMonth(lastMonth)]]);
    assert.equal(run.total, 3_000_000);
  });

  it('happen once per company and month', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    const again = await startRun();
    assert.equal(again.status, 409);
    assert.match(again.body.error, /already a salary run/);

    // Two people starting the same month at the same moment still get one run.
    const next = addMonthsToMonth(lastMonth, 1);
    const both = await Promise.all([startRun(next), h.as(w.bookkeeper).post('/salary/runs', { companyId: w.company.id, month: next })]);
    assert.deepEqual(both.map((res) => res.status).sort(), [201, 409]);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.admin).get('/salary/runs'))).length, 2);

    // Deleting the draft frees the month.
    assert.equal((await h.as(w.admin).delete(`/salary/runs/${run.id}`)).status, 204);
    await ok(startRun(), 201);
  });

  it('are refused when there is nobody to pay or the month is too far ahead', async () => {
    const empty = await ok<CompanyDto>(h.as(w.admin).post('/companies', { code: 'NL', name: 'Naton Lab Limited' }), 201);
    const none = await startRun(lastMonth, empty.id);
    assert.equal(none.status, 409);
    assert.match(none.body.error, /no active staff/);

    const far = await startRun(addMonthsToMonth(hkCurrentMonth(), 2));
    assert.equal(far.status, 400);
    assert.ok(far.body.fields.month);
    assert.equal((await startRun('2026-00')).status, 400);
  });

  it('can be adjusted line by line, and the total follows', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    const adjusted = await ok<ExpenseDto>(
      h.as(w.admin).put(`/salary/runs/${run.id}`, {
        lines: [
          { staffId: amy.id, amount: 3_200_000, note: 'Includes bonus' },
          { staffId: ben.id, amount: 1_250_025, note: 'Half month' },
        ],
        notes: 'Bonus month',
      }),
    );
    assert.equal(adjusted.total, 4_450_025);
    assert.deepEqual(adjusted.items.map((item) => item.note), ['Includes bonus', 'Half month']);

    // Someone can be left off, but not listed twice, and not borrowed from another company.
    const without = await ok<ExpenseDto>(h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: [{ staffId: amy.id, amount: 3_000_000 }] }));
    assert.equal(without.items.length, 1);

    const twice = await h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: [{ staffId: amy.id, amount: 1 }, { staffId: amy.id, amount: 1 }] });
    assert.equal(twice.status, 400);
    assert.match(twice.body.fields['lines.1.staffId'], /already on the run/);

    const other = await ok<CompanyDto>(h.as(w.admin).post('/companies', { code: 'NL', name: 'Naton Lab Limited' }), 201);
    const outsider = await ok<StaffDto>(h.as(w.admin).post('/salary/staff', { companyId: other.id, name: 'Dee', monthlySalary: 100 }), 201);
    const borrowed = await h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: [{ staffId: outsider.id, amount: 100 }] });
    assert.equal(borrowed.status, 400);
    assert.ok(borrowed.body.fields['lines.0.staffId']);

    const negative = await h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: [{ staffId: amy.id, amount: -1 }] });
    assert.ok(negative.body.fields['lines.0.amount']);
    const nothing = await h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: [{ staffId: amy.id, amount: 0 }] });
    assert.ok(nothing.body.fields.lines);
  });

  it('go through the same approval as an expense, and count in the P&L under Salary', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    assert.equal((await h.as(w.bookkeeper).post(`/salary/runs/${run.id}/pay`, { paidDate: today })).status, 409);

    await ok(h.as(w.admin).post(`/salary/runs/${run.id}/submit`));
    assert.match(h.emails[0].subject, /Salary run SAL-.* needs your approval/);
    // The admin prepared it and is not an approver.
    assert.equal((await h.as(w.admin).post(`/salary/runs/${run.id}/approve`)).status, 403);
    const approved = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/salary/runs/${run.id}/approve`));
    assert.equal(approved.status, 'approved');

    // Approved: committed in the salary month, not yet cash.
    const before = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${lastMonth}`));
    assert.deepEqual(before.billed.expenses.map((line) => [line.name, line.amount]), [['Salary', 5_500_050]]);
    assert.equal(before.cash.totalExpenses, 0);

    await ok(h.as(w.bookkeeper).post(`/salary/runs/${run.id}/pay`, { paidDate: today, reference: 'Payroll batch 7' }));
    const cashMonth = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${hkCurrentMonth()}`));
    assert.deepEqual(cashMonth.cash.expenses.map((line) => [line.name, line.amount]), [['Salary', 5_500_050]]);

    const salary = w.categories.find((category) => category.system === 'salary')!.id;
    const entries = await ok<PnlEntryDto[]>(
      h.as(w.bookkeeper).get(`/reports/pnl/entries?month=${lastMonth}&basis=billed&side=expense&categoryId=${salary}`),
    );
    assert.deepEqual(entries.map((entry) => [entry.source, entry.documentId, entry.counterparty, entry.amount]).sort(), [
      ['salary', run.id, 'Amy Chan', 3_000_000],
      ['salary', run.id, 'Ben Lee', 2_500_050],
    ]);
  });

  it('lose their approvals when an amount is changed after approval', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    await ok(h.as(w.admin).post(`/salary/runs/${run.id}/submit`));
    await ok(h.as(w.bookkeeper).post(`/salary/runs/${run.id}/approve`));

    const lines = linesOf(run);
    lines[0].amount = 9_000_000;
    const changed = await ok<ExpenseDto>(h.as(w.admin).put(`/salary/runs/${run.id}`, { lines }));
    assert.equal(changed.status, 'pending_approval');
    assert.equal(changed.approvals.length, 0);
    assert.equal((await h.as(w.bookkeeper).post(`/salary/runs/${run.id}/pay`, { paidDate: today })).status, 409);
  });

  it('are locked once paid; an admin can reverse one, which frees the month', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    await ok(h.as(w.admin).post(`/salary/runs/${run.id}/submit`));
    await ok(h.as(w.bookkeeper).post(`/salary/runs/${run.id}/approve`));
    await ok(h.as(w.bookkeeper).post(`/salary/runs/${run.id}/pay`, { paidDate: today }));

    assert.equal((await h.as(w.admin).put(`/salary/runs/${run.id}`, { lines: linesOf(run) })).status, 409);
    assert.equal((await h.as(w.admin).delete(`/salary/runs/${run.id}`)).status, 409);
    assert.equal((await startRun()).status, 409);

    assert.equal((await h.as(w.bookkeeper).post(`/salary/runs/${run.id}/reverse`, { reason: 'Wrong month' })).status, 403);
    const reversed = await ok<ExpenseDto>(h.as(w.admin).post(`/salary/runs/${run.id}/reverse`, { reason: 'Wrong month' }));
    assert.equal(reversed.status, 'reversed');
    const pnl = await ok<PnlMonthDto>(h.as(w.bookkeeper).get(`/reports/pnl?month=${lastMonth}`));
    assert.equal(pnl.billed.totalExpenses, 0);

    const replacement = await ok<ExpenseDto>(startRun(), 201);
    assert.notEqual(replacement.id, run.id);
  });

  it('are not reachable through the expense or claim addresses', async () => {
    const run = await ok<ExpenseDto>(startRun(), 201);
    assert.equal((await h.as(w.admin).get(`/expenses/${run.id}`)).status, 404);
    assert.equal((await h.as(w.admin).get(`/claims/${run.id}`)).status, 404);
    assert.equal((await h.as(w.admin).post(`/expenses/${run.id}/submit`)).status, 404);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.admin).get('/expenses'))).length, 0);
  });
});
