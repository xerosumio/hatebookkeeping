import type { Router } from 'express';
import { can, formatDate, hkToday, payInputSchema, reasonSchema, type ExpenseKind } from '@hbk/shared';
import { activityEntry, record } from '../../platform/activity.js';
import { currentUser } from '../../platform/auth.js';
import { conflict, forbidden, validationError } from '../../platform/errors.js';
import { parse, route } from '../../platform/http.js';
import { approvalEntry, approversToAsk, assertCanReachApproval, assertMayApprove, isFullyApproved, notify } from '../approval.js';
import { approvalPolicy } from '../settings/service.js';
import type { UserDoc } from '../users/model.js';
import { Expense, type ExpenseDoc } from './model.js';
import { KIND_LABEL, KIND_PATH, assertMayManage, expenseDto, loadExpense, ownerIds, summaryRows } from './service.js';

/**
 * The one approval-and-payment flow for expenses, claims and salary runs:
 *
 *   draft → pending approval → approved → paid
 *
 * Rejecting or withdrawing returns to draft. Changing an item after it was
 * submitted clears its approvals. A paid item is never edited; an admin
 * reverses it, with a reason, and it stops counting in the P&L.
 */

const pathOf = (expense: ExpenseDoc) => `${KIND_PATH[expense.kind]}/${String(expense._id)}`;
const label = (expense: ExpenseDoc) => `${KIND_LABEL[expense.kind]} ${expense.number}`;

/** The people to tell about an outcome: whoever entered it and, for a claim, whoever it pays. */
const interested = (expense: ExpenseDoc, except: UserDoc): string[] =>
  [...new Set([String(expense.createdById), ...(expense.claimantId ? [String(expense.claimantId)] : [])])].filter(
    (id) => id !== String(except._id),
  );

export function addAuthor(expense: ExpenseDoc, user: UserDoc): void {
  if (!expense.authorIds.some((id) => String(id) === String(user._id))) expense.authorIds.push(user._id);
}

async function askApprovers(expense: ExpenseDoc, user: UserDoc, intro: string): Promise<void> {
  const policy = await approvalPolicy();
  await notify(Expense, expense._id, user, approversToAsk(policy, ownerIds(expense)), `${label(expense)} needs your approval`, {
    heading: `${label(expense)} needs your approval`,
    intro,
    rows: summaryRows(expense),
    link: { label: 'Review it', path: pathOf(expense) },
  });
}

/**
 * Applies an edit to an item that may already be submitted or approved.
 * `apply` changes the content; this then clears approvals when needed and
 * saves against the version that was read.
 */
export async function saveEdit(expense: ExpenseDoc, user: UserDoc, apply: () => void): Promise<void> {
  if (expense.status === 'paid') throw conflict('This has been paid and can no longer be changed. An admin can reverse it.');
  if (expense.status === 'reversed') throw conflict('This has been reversed and can no longer be changed.');
  const wasSubmitted = expense.status !== 'draft';
  const hadApprovals = expense.approvals.length > 0;

  apply();
  addAuthor(expense, user);
  if (wasSubmitted) {
    // A changed item is a different item: whatever was approved before no longer stands.
    assertCanReachApproval(await approvalPolicy(), ownerIds(expense));
    expense.approvals = [];
    expense.status = 'pending_approval';
  }
  record(expense, user, 'Edited', hadApprovals ? 'Approvals cleared' : '');
  await expense.save();
  if (wasSubmitted) await askApprovers(expense, user, `${user.name} changed it, so it needs approval again.`);
}

/** Checks made just before an item is submitted, beyond what the form already guarantees. */
export type SubmitCheck = (expense: ExpenseDoc) => void;

export function mountFlow(router: Router, kind: ExpenseKind, beforeSubmit: SubmitCheck = () => {}): void {
  const respond = async (id: unknown, user: UserDoc) => expenseDto(await loadExpense(id, kind, user), user);

  router.post(
    '/:id/submit',
    route(async (req, res) => {
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      assertMayManage(expense, user);
      if (expense.status !== 'draft') throw conflict('This has already been submitted.');
      beforeSubmit(expense);
      addAuthor(expense, user);
      assertCanReachApproval(await approvalPolicy(), ownerIds(expense));

      expense.status = 'pending_approval';
      expense.approvals = [];
      expense.rejectionReason = '';
      record(expense, user, 'Submitted for approval');
      await expense.save();
      await askApprovers(expense, user, `${user.name} submitted it for approval.`);
      res.json(await respond(req.params.id, user));
    }),
  );

  router.post(
    '/:id/approve',
    route(async (req, res) => {
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      if (expense.status !== 'pending_approval') throw conflict('This is not waiting for approval.');
      const policy = await approvalPolicy();
      assertMayApprove(policy, user, ownerIds(expense), expense.approvals);

      expense.approvals.push(approvalEntry(user));
      const done = isFullyApproved(policy, expense.approvals);
      if (done) expense.status = 'approved';
      record(expense, user, 'Approved', done ? '' : `${expense.approvals.length} of ${policy.required} approvals`);
      await expense.save();

      if (done) {
        await notify(Expense, expense._id, user, interested(expense, user), `${label(expense)} was approved`, {
          heading: `${label(expense)} was approved`,
          intro: `${user.name} approved it. It can now be paid.`,
          rows: summaryRows(expense),
          link: { label: 'Open it', path: pathOf(expense) },
        });
      }
      res.json(await respond(req.params.id, user));
    }),
  );

  router.post(
    '/:id/reject',
    route(async (req, res) => {
      const { reason } = parse(reasonSchema, req.body);
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      if (expense.status !== 'pending_approval') throw conflict('This is not waiting for approval.');
      assertMayApprove(await approvalPolicy(), user, ownerIds(expense), expense.approvals);

      expense.status = 'draft';
      expense.approvals = [];
      expense.rejectionReason = reason;
      record(expense, user, 'Rejected', reason);
      await expense.save();

      await notify(Expense, expense._id, user, interested(expense, user), `${label(expense)} was rejected`, {
        heading: `${label(expense)} was rejected`,
        intro: `${user.name} rejected it: ${reason}`,
        rows: summaryRows(expense),
        link: { label: 'Open it', path: pathOf(expense) },
      });
      res.json(await respond(req.params.id, user));
    }),
  );

  /** Takes a submitted or approved item back to draft. Its approvals are cleared. */
  router.post(
    '/:id/withdraw',
    route(async (req, res) => {
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      assertMayManage(expense, user);
      if (expense.status !== 'pending_approval' && expense.status !== 'approved') {
        throw conflict('Only an item that is waiting for approval or approved can be taken back to draft.');
      }
      const hadApprovals = expense.approvals.length > 0;
      expense.status = 'draft';
      expense.approvals = [];
      record(expense, user, 'Taken back to draft', hadApprovals ? 'Approvals cleared' : '');
      await expense.save();
      res.json(await respond(req.params.id, user));
    }),
  );

  router.post(
    '/:id/pay',
    route(async (req, res) => {
      const input = parse(payInputSchema, req.body);
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      if (!can(user.role, 'expenses.pay')) throw forbidden('Only an admin or bookkeeper can mark this as paid.');
      if (input.paidDate > hkToday()) throw validationError({ paidDate: 'This cannot be in the future' });

      // The status check is part of the update, so an item whose approvals
      // were cleared a moment ago cannot slip through as paid.
      const paid = await Expense.findOneAndUpdate(
        { _id: expense._id, status: 'approved' },
        {
          $set: { status: 'paid', paidDate: input.paidDate, paymentReference: input.reference },
          $push: {
            activity: activityEntry(user, 'Marked as paid', `${formatDate(input.paidDate)}${input.reference ? ` · ${input.reference}` : ''}`),
          },
          $inc: { __v: 1 },
        },
        { new: true },
      );
      if (!paid) {
        if (expense.status === 'paid') throw conflict('This has already been marked as paid.');
        throw conflict('This must be approved before it can be marked as paid.');
      }

      if (paid.kind === 'claim') {
        await notify(Expense, paid._id, user, interested(paid, user), `${label(paid)} was paid`, {
          heading: `${label(paid)} was paid`,
          intro: `It was paid on ${formatDate(input.paidDate)}.`,
          rows: summaryRows(paid),
          link: { label: 'Open it', path: pathOf(paid) },
        });
      }
      res.json(await respond(req.params.id, user));
    }),
  );

  /** A paid item is never edited or deleted. An admin reverses it; it stays on file and leaves the P&L. */
  router.post(
    '/:id/reverse',
    route(async (req, res) => {
      const { reason } = parse(reasonSchema, req.body);
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      if (!can(user.role, 'expenses.reverse')) throw forbidden('Only an admin can reverse a paid item.');

      const reversed = await Expense.findOneAndUpdate(
        { _id: expense._id, status: 'paid' },
        {
          $set: { status: 'reversed', reversalReason: reason },
          $unset: { salarySlot: 1 },
          $push: { activity: activityEntry(user, 'Reversed', reason) },
          $inc: { __v: 1 },
        },
        { new: true },
      );
      if (!reversed) throw conflict('Only a paid item can be reversed.');
      res.json(await respond(req.params.id, user));
    }),
  );

  router.delete(
    '/:id',
    route(async (req, res) => {
      const user = currentUser(req);
      const expense = await loadExpense(req.params.id, kind, user);
      assertMayManage(expense, user);
      const deleted = await Expense.deleteOne({ _id: expense._id, status: 'draft' });
      if (deleted.deletedCount === 0) throw conflict('Only a draft can be deleted. Take it back to draft first, or have an admin reverse it if it was paid.');
      res.status(204).end();
    }),
  );
}
