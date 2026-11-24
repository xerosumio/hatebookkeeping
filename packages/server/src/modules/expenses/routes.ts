import { Router } from 'express';
import {
  EXPENSE_STATUSES,
  can,
  claimInputSchema,
  expenseInputSchema,
  hkToday,
  sumCents,
  type ClaimInput,
  type ExpenseInput,
  type ExpenseStatus,
} from '@hbk/shared';
import { record } from '../../platform/activity.js';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { badRequest, validationError } from '../../platform/errors.js';
import { objectId, parse, queryString, route } from '../../platform/http.js';
import { companyForInput, nextInternalNumber } from '../companies/service.js';
import { assertFilesUsable } from '../files/service.js';
import { payeeForInput } from '../payees/routes.js';
import { assertCategories, loadCategories } from '../settings/service.js';
import type { UserDoc } from '../users/model.js';
import { mountFlow, saveEdit } from './flow.js';
import { Expense, type ExpenseAttrs, type ExpenseDoc } from './model.js';
import { assertMayManage, expenseDto, expenseDtos, loadExpense } from './service.js';

type Content = Pick<ExpenseAttrs, 'companyId' | 'title' | 'payeeId' | 'expenseDate' | 'dueDate' | 'items' | 'total' | 'notes' | 'attachmentIds'>;

function statusFilter(status: string | undefined): Record<string, unknown> {
  if (status === 'open') return { status: { $in: ['draft', 'pending_approval', 'approved'] } };
  if (status && EXPENSE_STATUSES.includes(status as ExpenseStatus)) return { status };
  return {};
}

// ── Expenses ────────────────────────────────────────────────────────────────

/** Checks everything an expense form refers to, and returns the fields to store. */
async function expenseContent(input: ExpenseInput, user: UserDoc, current?: ExpenseDoc): Promise<Content> {
  if (input.dueDate && input.dueDate < input.expenseDate) throw validationError({ dueDate: 'This is before the expense date' });
  await Promise.all([companyForInput(input.companyId, current?.companyId), payeeForInput(input.payeeId, current?.payeeId)]);
  assertCategories(
    await loadCategories(),
    'expense',
    input.items.map((item) => item.categoryId),
    (index) => `items.${index}.categoryId`,
    new Set(current?.items.map((item) => String(item.categoryId))),
  );
  await assertFilesUsable(
    user,
    'receipt',
    input.attachmentIds.map((id, index) => ({ id, path: `attachmentIds.${index}` })),
    new Set(current?.attachmentIds.map(String)),
  );
  return {
    companyId: objectId(input.companyId),
    title: input.title,
    payeeId: objectId(input.payeeId),
    expenseDate: input.expenseDate,
    dueDate: input.dueDate,
    items: input.items.map((item) => ({
      description: item.description,
      categoryId: objectId(item.categoryId),
      amount: item.amount,
      date: input.expenseDate,
      receiptFileId: null,
      staffId: null,
      note: '',
    })),
    total: sumCents(input.items.map((item) => item.amount)),
    notes: input.notes,
    attachmentIds: input.attachmentIds.map((id) => objectId(id)),
  };
}

export const expenseRouter = Router();
expenseRouter.use(requirePermission('expenses.view'));

expenseRouter.get(
  '/',
  route(async (req, res) => {
    const filter: Record<string, unknown> = { kind: 'expense', ...statusFilter(queryString(req, 'status')) };
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    const payeeId = queryString(req, 'payeeId');
    if (payeeId) filter.payeeId = objectId(payeeId, 'That payee');
    const expenses = await Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 });
    res.json(await expenseDtos(expenses, currentUser(req)));
  }),
);

expenseRouter.get(
  '/:id',
  route(async (req, res) => {
    const user = currentUser(req);
    res.json(await expenseDto(await loadExpense(req.params.id, 'expense', user), user));
  }),
);

expenseRouter.post(
  '/',
  requirePermission('expenses.manage'),
  route(async (req, res) => {
    const user = currentUser(req);
    const content = await expenseContent(parse(expenseInputSchema, req.body), user);
    const expense = new Expense({
      ...content,
      kind: 'expense',
      number: await nextInternalNumber('expense'),
      authorIds: [user._id],
      createdById: user._id,
      createdByName: user.name,
    });
    record(expense, user, 'Created');
    await expense.save();
    res.status(201).json(await expenseDto(expense, user));
  }),
);

expenseRouter.put(
  '/:id',
  route(async (req, res) => {
    const input = parse(expenseInputSchema, req.body);
    const user = currentUser(req);
    const expense = await loadExpense(req.params.id, 'expense', user);
    assertMayManage(expense, user);
    const content = await expenseContent(input, user, expense);
    await saveEdit(expense, user, () => expense.set(content));
    res.json(await expenseDto(await loadExpense(req.params.id, 'expense', user), user));
  }),
);

mountFlow(expenseRouter, 'expense');

// ── Claims ──────────────────────────────────────────────────────────────────

async function claimContent(input: ClaimInput, user: UserDoc, current?: ExpenseDoc): Promise<Content> {
  const today = hkToday();
  const future: Record<string, string> = {};
  input.items.forEach((item, index) => {
    if (item.date > today) future[`items.${index}.date`] = 'This cannot be in the future';
  });
  if (Object.keys(future).length > 0) throw validationError(future);

  await companyForInput(input.companyId, current?.companyId);
  assertCategories(
    await loadCategories(),
    'expense',
    input.items.map((item) => item.categoryId),
    (index) => `items.${index}.categoryId`,
    new Set(current?.items.map((item) => String(item.categoryId))),
  );
  await assertFilesUsable(
    user,
    'receipt',
    input.items.map((item, index) => ({ id: item.receiptFileId, path: `items.${index}.receiptFileId` })),
    new Set(current?.items.flatMap((item) => (item.receiptFileId ? [String(item.receiptFileId)] : []))),
  );
  const dates = input.items.map((item) => item.date).sort();
  return {
    companyId: objectId(input.companyId),
    title: input.title,
    payeeId: null,
    expenseDate: dates[dates.length - 1],
    dueDate: null,
    items: input.items.map((item) => ({
      description: item.description,
      categoryId: objectId(item.categoryId),
      amount: item.amount,
      date: item.date,
      receiptFileId: item.receiptFileId ? objectId(item.receiptFileId) : null,
      staffId: null,
      note: '',
    })),
    total: sumCents(input.items.map((item) => item.amount)),
    notes: input.notes,
    attachmentIds: [],
  };
}

export const claimRouter = Router();
claimRouter.use(requirePermission('claims.own'));

/**
 * Staff get their own claims and nothing else, whatever they ask for. The
 * office gets everyone's, or just their own with `mine=true`.
 */
claimRouter.get(
  '/',
  route(async (req, res) => {
    const user = currentUser(req);
    const filter: Record<string, unknown> = { kind: 'claim', ...statusFilter(queryString(req, 'status')) };
    const companyId = queryString(req, 'companyId');
    if (companyId) filter.companyId = objectId(companyId, 'That company');
    if (!can(user.role, 'claims.viewAll') || queryString(req, 'mine') === 'true') filter.claimantId = user._id;
    const claims = await Expense.find(filter).sort({ createdAt: -1 });
    res.json(await expenseDtos(claims, user));
  }),
);

claimRouter.get(
  '/:id',
  route(async (req, res) => {
    const user = currentUser(req);
    res.json(await expenseDto(await loadExpense(req.params.id, 'claim', user), user));
  }),
);

/** A claim is always the claim of the person entering it. */
claimRouter.post(
  '/',
  route(async (req, res) => {
    const user = currentUser(req);
    const content = await claimContent(parse(claimInputSchema, req.body), user);
    const claim = new Expense({
      ...content,
      kind: 'claim',
      number: await nextInternalNumber('claim'),
      claimantId: user._id,
      claimantName: user.name,
      authorIds: [user._id],
      createdById: user._id,
      createdByName: user.name,
    });
    record(claim, user, 'Created');
    await claim.save();
    res.status(201).json(await expenseDto(claim, user));
  }),
);

claimRouter.put(
  '/:id',
  route(async (req, res) => {
    const input = parse(claimInputSchema, req.body);
    const user = currentUser(req);
    const claim = await loadExpense(req.params.id, 'claim', user);
    assertMayManage(claim, user);
    const content = await claimContent(input, user, claim);
    await saveEdit(claim, user, () => claim.set(content));
    res.json(await expenseDto(await loadExpense(req.params.id, 'claim', user), user));
  }),
);

mountFlow(claimRouter, 'claim', (claim) => {
  const missing: Record<string, string> = {};
  claim.items.forEach((item, index) => {
    if (!item.receiptFileId) missing[`items.${index}.receiptFileId`] = 'Attach the receipt';
  });
  if (Object.keys(missing).length > 0) {
    throw badRequest('Every line needs its receipt before the claim can be submitted.', missing);
  }
});
