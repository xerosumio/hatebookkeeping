import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { addDays, hkToday, type ExpenseDto, type FileDto, type PayeeDto } from '@hbk/shared';
import { PNG, upload, world, type World } from './support/fixtures.js';
import { startHarness, type Harness, type TestUser } from './support/harness.js';

let h: Harness;
let w: World;
let payee: PayeeDto;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());
beforeEach(async () => {
  await h.reset();
  w = await world(h);
  payee = (await h.as(w.admin).post('/payees', { name: 'Office Landlord Ltd', bankName: 'HSBC', bankAccountNumber: '111-222' })).body;
});

const today = hkToday();

async function ok<T>(test: PromiseLike<{ status: number; body: unknown }>, status = 200): Promise<T> {
  const res = await test;
  assert.equal(res.status, status, JSON.stringify(res.body));
  return res.body as T;
}

const expenseInput = (extra: Record<string, unknown> = {}) => ({
  companyId: w.company.id,
  title: 'Office rent',
  payeeId: payee.id,
  expenseDate: today,
  items: [
    { description: 'Rent', categoryId: w.category('expense'), amount: 1_500_000 },
    { description: 'Management fee', categoryId: w.category('expense'), amount: 120_050 },
  ],
  ...extra,
});

async function receipt(user: TestUser): Promise<string> {
  const res = await upload(h, user, 'receipt', PNG, 'receipt.png');
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return (res.body as FileDto).id;
}

const claimInput = async (user: TestUser, extra: Record<string, unknown> = {}) => ({
  companyId: w.company.id,
  title: 'Client lunch',
  items: [{ date: today, description: 'Lunch with Acme', categoryId: w.category('expense'), amount: 45_000, receiptFileId: await receipt(user) }],
  ...extra,
});

/** An expense written by the admin and approved by the bookkeeper. */
async function approvedExpense(): Promise<ExpenseDto> {
  const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
  await ok(h.as(w.admin).post(`/expenses/${expense.id}/submit`));
  return ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`));
}

async function submittedClaim(user: TestUser = w.staff): Promise<ExpenseDto> {
  const claim = await ok<ExpenseDto>(h.as(user).post('/claims', await claimInput(user)), 201);
  return ok<ExpenseDto>(h.as(user).post(`/claims/${claim.id}/submit`));
}

describe('payees', () => {
  it('are for the office only, because they carry bank details', async () => {
    assert.equal((await h.as(w.staff).get('/payees')).status, 403);
    assert.equal((await h.as(w.staff).post('/payees', { name: 'Me' })).status, 403);
    const list = await ok<PayeeDto[]>(h.as(w.bookkeeper).get('/payees'));
    assert.equal(list[0].bankAccountNumber, '111-222');
  });

  it('cannot be deleted once an expense uses them, but can be archived', async () => {
    await ok(h.as(w.admin).post('/expenses', expenseInput()), 201);
    const refused = await h.as(w.admin).delete(`/payees/${payee.id}`);
    assert.equal(refused.status, 409);
    assert.match(refused.body.error, /1 expense/);

    await ok(h.as(w.admin).post(`/payees/${payee.id}/archive`));
    const onNew = await h.as(w.admin).post('/expenses', expenseInput());
    assert.equal(onNew.status, 400);
    assert.match(onNew.body.fields.payeeId, /archived/);

    const unused = await ok<PayeeDto>(h.as(w.admin).post('/payees', { name: 'Never used' }), 201);
    assert.equal((await h.as(w.admin).delete(`/payees/${unused.id}`)).status, 204);
  });
});

describe('expenses', () => {
  it('adds up the total on the server and files each line under its category', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.bookkeeper).post('/expenses', { ...expenseInput(), total: 1 }), 201);
    assert.equal(expense.total, 1_620_050);
    assert.match(expense.number, /^EXP-\d{4}-0001$/);
    assert.equal(expense.status, 'draft');
    assert.equal(expense.payee?.name, 'Office Landlord Ltd');
    assert.ok(expense.items.every((item) => item.date === today && item.categoryName));
  });

  it('refuses bad input next to the field it belongs to', async () => {
    const incomeCategory = w.category('income');
    const salary = w.categories.find((category) => category.system === 'salary')!;
    const res = await h.as(w.admin).post(
      '/expenses',
      expenseInput({
        items: [
          { description: 'A', categoryId: incomeCategory, amount: 100 },
          { description: 'B', categoryId: salary.id, amount: 100 },
        ],
      }),
    );
    assert.equal(res.status, 400);
    assert.match(res.body.fields['items.0.categoryId'], /expense category/);
    assert.match(res.body.fields['items.1.categoryId'], /salary run/);

    const zero = await h.as(w.admin).post('/expenses', expenseInput({ items: [{ description: 'A', categoryId: w.category('expense'), amount: 0 }] }));
    assert.equal(zero.status, 400);
    assert.ok(zero.body.fields['items.0.amount']);

    const due = await h.as(w.admin).post('/expenses', expenseInput({ dueDate: addDays(today, -1) }));
    assert.ok(due.body.fields.dueDate);
  });

  it('is not open to staff at all', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    assert.equal((await h.as(w.staff).get('/expenses')).status, 403);
    assert.equal((await h.as(w.staff).get(`/expenses/${expense.id}`)).status, 403);
    assert.equal((await h.as(w.staff).post('/expenses', expenseInput())).status, 403);
    assert.equal((await h.as(w.staff).post(`/expenses/${expense.id}/submit`)).status, 403);
    // The claims address does not reveal an expense either.
    assert.equal((await h.as(w.staff).get(`/claims/${expense.id}`)).status, 404);
  });

  it('cannot be paid before it is approved', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    const asDraft = await h.as(w.admin).post(`/expenses/${expense.id}/pay`, { paidDate: today });
    assert.equal(asDraft.status, 409);
    await ok(h.as(w.admin).post(`/expenses/${expense.id}/submit`));
    const asPending = await h.as(w.bookkeeper).post(`/expenses/${expense.id}/pay`, { paidDate: today });
    assert.equal(asPending.status, 409);
    assert.match(asPending.body.error, /approved before/);
  });

  it('cannot be approved by the person who wrote it, even if they are an approver', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.bookkeeper).post('/expenses', expenseInput()), 201);
    const submitted = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${expense.id}/submit`));
    assert.ok(!submitted.actions.includes('approve'));

    const own = await h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`);
    assert.equal(own.status, 403);
    assert.match(own.body.error, /your own/);
    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${expense.id}/reject`, { reason: 'no' })).status, 403);

    // An admin who is not a chosen approver cannot approve either.
    const notChosen = await h.as(w.admin).post(`/expenses/${expense.id}/approve`);
    assert.equal(notChosen.status, 403);
    assert.match(notChosen.body.error, /chosen in Settings/);

    const approved = await ok<ExpenseDto>(h.as(w.approver).post(`/expenses/${expense.id}/approve`));
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvals[0].userName, 'Cy Approver');
  });

  it('counts someone who edited or submitted it as an author too', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    await ok(h.as(w.bookkeeper).put(`/expenses/${expense.id}`, expenseInput({ title: 'Office rent (May)' })));
    await ok(h.as(w.admin).post(`/expenses/${expense.id}/submit`));
    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`)).status, 403);
    await ok(h.as(w.approver).post(`/expenses/${expense.id}/approve`));
  });

  it('needs every required approval, each from a different person', async () => {
    await ok(h.as(w.admin).put('/settings/approval', { approverIds: [w.bookkeeper.id, w.approver.id], approvalsRequired: 2 }));
    const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    await ok(h.as(w.admin).post(`/expenses/${expense.id}/submit`));

    const first = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`));
    assert.equal(first.status, 'pending_approval');
    const again = await h.as(w.bookkeeper).post(`/expenses/${expense.id}/approve`);
    assert.equal(again.status, 403);
    assert.match(again.body.error, /already approved/);

    const second = await ok<ExpenseDto>(h.as(w.approver).post(`/expenses/${expense.id}/approve`));
    assert.equal(second.status, 'approved');
    assert.equal(second.approvals.length, 2);
  });

  it('cannot be submitted when nobody else could approve it', async () => {
    await ok(h.as(w.admin).put('/settings/approval', { approverIds: [w.bookkeeper.id], approvalsRequired: 1 }));
    const expense = await ok<ExpenseDto>(h.as(w.bookkeeper).post('/expenses', expenseInput()), 201);
    const res = await h.as(w.bookkeeper).post(`/expenses/${expense.id}/submit`);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /choose more approvers/);
    assert.equal((await ok<ExpenseDto>(h.as(w.bookkeeper).get(`/expenses/${expense.id}`))).status, 'draft');
  });

  it('loses its approvals when it is changed after approval', async () => {
    const approved = await approvedExpense();
    assert.equal(approved.status, 'approved');

    const changed = await ok<ExpenseDto>(
      h.as(w.admin).put(`/expenses/${approved.id}`, expenseInput({ items: [{ description: 'Rent', categoryId: w.category('expense'), amount: 9_999_900 }] })),
    );
    assert.equal(changed.status, 'pending_approval');
    assert.equal(changed.approvals.length, 0);
    assert.equal(changed.total, 9_999_900);
    assert.ok(changed.activity.some((entry) => entry.action === 'Edited' && entry.note === 'Approvals cleared'));

    // The larger amount cannot be paid on the strength of the old approval.
    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: today })).status, 409);
    await ok(h.as(w.bookkeeper).post(`/expenses/${approved.id}/approve`));
    await ok(h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: today }));
  });

  it('goes back to draft with the reason when it is rejected', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    await ok(h.as(w.admin).post(`/expenses/${expense.id}/submit`));
    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${expense.id}/reject`, { reason: '' })).status, 400);

    const rejected = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${expense.id}/reject`, { reason: 'Wrong amount' }));
    assert.equal(rejected.status, 'draft');
    assert.equal(rejected.rejectionReason, 'Wrong amount');

    const resubmitted = await ok<ExpenseDto>(h.as(w.admin).post(`/expenses/${expense.id}/submit`));
    assert.equal(resubmitted.rejectionReason, '');
  });

  it('can be taken back to draft, which clears its approvals, and only a draft can be deleted', async () => {
    const approved = await approvedExpense();
    assert.equal((await h.as(w.admin).delete(`/expenses/${approved.id}`)).status, 409);

    const draft = await ok<ExpenseDto>(h.as(w.admin).post(`/expenses/${approved.id}/withdraw`));
    assert.equal(draft.status, 'draft');
    assert.equal(draft.approvals.length, 0);
    assert.equal((await h.as(w.admin).delete(`/expenses/${approved.id}`)).status, 204);
    assert.equal((await h.as(w.admin).get(`/expenses/${approved.id}`)).status, 404);
  });

  it('is locked once paid, and only an admin can reverse it', async () => {
    const approved = await approvedExpense();
    const future = await h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: addDays(today, 1) });
    assert.equal(future.status, 400);

    const paid = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: today, reference: 'FPS 123' }));
    assert.equal(paid.status, 'paid');
    assert.equal(paid.paidDate, today);
    assert.equal(paid.paymentReference, 'FPS 123');
    assert.deepEqual(paid.actions, []);

    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: today })).status, 409);
    assert.equal((await h.as(w.admin).put(`/expenses/${approved.id}`, expenseInput({ title: 'Changed' }))).status, 409);
    assert.equal((await h.as(w.admin).delete(`/expenses/${approved.id}`)).status, 409);
    assert.equal((await h.as(w.admin).post(`/expenses/${approved.id}/withdraw`)).status, 409);

    assert.equal((await h.as(w.bookkeeper).post(`/expenses/${approved.id}/reverse`, { reason: 'Paid twice' })).status, 403);
    assert.equal((await h.as(w.admin).post(`/expenses/${approved.id}/reverse`, {})).status, 400);
    const reversed = await ok<ExpenseDto>(h.as(w.admin).post(`/expenses/${approved.id}/reverse`, { reason: 'Paid twice' }));
    assert.equal(reversed.status, 'reversed');
    assert.equal(reversed.reversalReason, 'Paid twice');
    assert.equal((await h.as(w.admin).post(`/expenses/${approved.id}/reverse`, { reason: 'again' })).status, 409);
    assert.equal((await h.as(w.admin).put(`/expenses/${approved.id}`, expenseInput())).status, 409);
  });

  it('pays once when two people mark it paid at the same moment', async () => {
    const approved = await approvedExpense();
    const results = await Promise.all([
      h.as(w.bookkeeper).post(`/expenses/${approved.id}/pay`, { paidDate: today, reference: 'A' }),
      h.as(w.admin).post(`/expenses/${approved.id}/pay`, { paidDate: today, reference: 'B' }),
    ]);
    assert.deepEqual(results.map((res) => res.status).sort(), [200, 409]);
    const after = await ok<ExpenseDto>(h.as(w.admin).get(`/expenses/${approved.id}`));
    assert.equal(after.activity.filter((entry) => entry.action === 'Marked as paid').length, 1);
  });

  it('emails the approvers who can act, and says so when the email failed', async () => {
    const expense = await ok<ExpenseDto>(h.as(w.bookkeeper).post('/expenses', expenseInput()), 201);
    await ok(h.as(w.bookkeeper).post(`/expenses/${expense.id}/submit`));
    assert.equal(h.emails.length, 1);
    // The author is an approver too, but is not asked to approve their own item.
    assert.deepEqual(h.emails[0].to, [w.approver.email]);
    assert.match(h.emails[0].subject, /needs your approval/);

    h.failEmails('mailbox unavailable');
    const second = await ok<ExpenseDto>(h.as(w.admin).post('/expenses', expenseInput()), 201);
    const submitted = await ok<ExpenseDto>(h.as(w.admin).post(`/expenses/${second.id}/submit`));
    // It is still submitted; the history says the email did not go out.
    assert.equal(submitted.status, 'pending_approval');
    const failed = submitted.activity.find((entry) => entry.action === 'Email failed');
    assert.ok(failed);
    assert.ok(!submitted.activity.some((entry) => entry.action === 'Email sent'));
  });

  it('lists by status, company and payee', async () => {
    const approved = await approvedExpense();
    await ok(h.as(w.admin).post('/expenses', expenseInput({ title: 'Draft one' })), 201);
    const drafts = await ok<ExpenseDto[]>(h.as(w.admin).get('/expenses?status=draft'));
    assert.deepEqual(drafts.map((expense) => expense.title), ['Draft one']);
    const forPayee = await ok<ExpenseDto[]>(h.as(w.admin).get(`/expenses?payeeId=${payee.id}&status=approved`));
    assert.deepEqual(forPayee.map((expense) => expense.id), [approved.id]);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.admin).get('/expenses?status=open'))).length, 2);
  });
});

describe('claims', () => {
  it('belong to the person who enters them, whatever the request says', async () => {
    const claim = await ok<ExpenseDto>(
      h.as(w.staff).post('/claims', { ...(await claimInput(w.staff)), claimantId: w.admin.id, status: 'approved' }),
      201,
    );
    assert.equal(claim.kind, 'claim');
    assert.equal(claim.claimant?.id, w.staff.id);
    assert.equal(claim.status, 'draft');
    assert.match(claim.number, /^CLM-\d{4}-0001$/);
  });

  it('are seen only by their owner and the office', async () => {
    const other = await h.user('staff', 'Otto Other');
    const mine = await submittedClaim(w.staff);
    const theirs = await submittedClaim(other);

    const staffList = await ok<ExpenseDto[]>(h.as(w.staff).get('/claims'));
    assert.deepEqual(staffList.map((claim) => claim.id), [mine.id]);
    // Asking for a wider list changes nothing for staff.
    const wide = await ok<ExpenseDto[]>(h.as(w.staff).get('/claims?mine=false&status=pending_approval'));
    assert.deepEqual(wide.map((claim) => claim.id), [mine.id]);

    assert.equal((await h.as(w.staff).get(`/claims/${theirs.id}`)).status, 404);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.bookkeeper).get('/claims'))).length, 2);
    assert.equal((await ok<ExpenseDto[]>(h.as(w.bookkeeper).get('/claims?mine=true'))).length, 0);
  });

  it('cannot be changed, withdrawn, deleted, approved or paid by another staff member', async () => {
    const other = await h.user('staff', 'Otto Other');
    const draft = await ok<ExpenseDto>(h.as(w.staff).post('/claims', await claimInput(w.staff)), 201);

    for (const res of [
      await h.as(other).put(`/claims/${draft.id}`, await claimInput(other)),
      await h.as(other).post(`/claims/${draft.id}/submit`),
      await h.as(other).delete(`/claims/${draft.id}`),
    ]) {
      assert.equal(res.status, 404);
    }

    await ok(h.as(w.staff).post(`/claims/${draft.id}/submit`));
    for (const action of ['approve', 'withdraw', 'reject', 'pay', 'reverse']) {
      const res = await h.as(other).post(`/claims/${draft.id}/${action}`, { reason: 'x', paidDate: today });
      assert.equal(res.status, 404, action);
    }
    // The owner is not an approver or payer of their own claim.
    assert.equal((await h.as(w.staff).post(`/claims/${draft.id}/approve`)).status, 403);
    assert.equal((await h.as(w.staff).post(`/claims/${draft.id}/pay`, { paidDate: today })).status, 403);
    const still = await ok<ExpenseDto>(h.as(w.staff).get(`/claims/${draft.id}`));
    assert.equal(still.status, 'pending_approval');
    assert.deepEqual(still.actions.sort(), ['edit', 'withdraw']);
  });

  it('keep receipts private to the claimant and the office', async () => {
    const other = await h.user('staff', 'Otto Other');
    const claim = await submittedClaim(w.staff);
    const fileId = claim.items[0].receiptFileId!;
    assert.equal((await h.as(w.staff).get(`/files/${fileId}`)).status, 200);
    assert.equal((await h.as(w.bookkeeper).get(`/files/${fileId}`)).status, 200);
    assert.equal((await h.as(other).get(`/files/${fileId}`)).status, 404);
    assert.equal((await h.as(null).get(`/files/${fileId}`)).status, 401);

    // Someone else's receipt cannot be attached to a claim.
    const borrowed = await h.as(other).post('/claims', {
      ...(await claimInput(other)),
      items: [{ date: today, description: 'Lunch', categoryId: w.category('expense'), amount: 100, receiptFileId: fileId }],
    });
    assert.equal(borrowed.status, 400);
    assert.ok(borrowed.body.fields['items.0.receiptFileId']);
  });

  it('need a receipt on every line before they are submitted', async () => {
    const claim = await ok<ExpenseDto>(
      h.as(w.staff).post('/claims', {
        ...(await claimInput(w.staff)),
        items: [{ date: today, description: 'Taxi', categoryId: w.category('expense'), amount: 8_000, receiptFileId: null }],
      }),
      201,
    );
    const res = await h.as(w.staff).post(`/claims/${claim.id}/submit`);
    assert.equal(res.status, 400);
    assert.equal(res.body.fields['items.0.receiptFileId'], 'Attach the receipt');

    const future = await h.as(w.staff).post('/claims', {
      ...(await claimInput(w.staff)),
      items: [{ date: addDays(today, 2), description: 'Taxi', categoryId: w.category('expense'), amount: 8_000, receiptFileId: null }],
    });
    assert.equal(future.status, 400);
    assert.ok(future.body.fields['items.0.date']);
  });

  it('are approved and paid like an expense, and the claimant is told', async () => {
    const claim = await submittedClaim(w.staff);
    assert.deepEqual(h.emails[0].to.sort(), [w.bookkeeper.email, w.approver.email].sort());

    const approved = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/claims/${claim.id}/approve`));
    assert.equal(approved.status, 'approved');
    assert.deepEqual(h.emails[1].to, [w.staff.email]);

    const paid = await ok<ExpenseDto>(h.as(w.bookkeeper).post(`/claims/${claim.id}/pay`, { paidDate: today, reference: 'FPS' }));
    assert.equal(paid.status, 'paid');
    assert.match(h.emails[2].subject, /was paid/);

    const seenByOwner = await ok<ExpenseDto>(h.as(w.staff).get(`/claims/${claim.id}`));
    assert.equal(seenByOwner.status, 'paid');
    assert.deepEqual(seenByOwner.actions, []);
    assert.equal((await h.as(w.staff).put(`/claims/${claim.id}`, await claimInput(w.staff))).status, 409);
  });

  it('cannot be approved by an approver claiming for themselves', async () => {
    const claim = await submittedClaim(w.bookkeeper);
    assert.equal((await h.as(w.bookkeeper).post(`/claims/${claim.id}/approve`)).status, 403);
    await ok(h.as(w.approver).post(`/claims/${claim.id}/approve`));
  });

  it('go back for approval when the claimant changes an approved claim', async () => {
    const claim = await submittedClaim(w.staff);
    await ok(h.as(w.bookkeeper).post(`/claims/${claim.id}/approve`));
    const input = await claimInput(w.staff);
    input.items[0].amount = 900_000;
    const changed = await ok<ExpenseDto>(h.as(w.staff).put(`/claims/${claim.id}`, input));
    assert.equal(changed.status, 'pending_approval');
    assert.equal(changed.approvals.length, 0);
    assert.equal((await h.as(w.bookkeeper).post(`/claims/${claim.id}/pay`, { paidDate: today })).status, 409);
  });

  it('make an office user who corrects a claim one of its authors', async () => {
    const claim = await submittedClaim(w.staff);
    const input = await claimInput(w.staff);
    // The office keeps the claimant's receipt; it does not have to own the file.
    input.items[0].receiptFileId = claim.items[0].receiptFileId!;
    input.items[0].description = 'Lunch with Acme (corrected)';
    const corrected = await ok<ExpenseDto>(h.as(w.bookkeeper).put(`/claims/${claim.id}`, input));
    assert.equal(corrected.claimant?.id, w.staff.id);
    assert.equal((await h.as(w.bookkeeper).post(`/claims/${claim.id}/approve`)).status, 403);
    await ok(h.as(w.approver).post(`/claims/${claim.id}/approve`));
  });
});
