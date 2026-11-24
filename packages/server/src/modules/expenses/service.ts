import { can, formatMoney, type ExpenseAction, type ExpenseDto, type ExpenseKind } from '@hbk/shared';
import { activityDto, approvalDto } from '../../platform/activity.js';
import { AppError, notFound } from '../../platform/errors.js';
import { countLabel, namesOf, refOf, registerReference } from '../../platform/references.js';
import { approvalBlocker } from '../approval.js';
import { Company } from '../companies/model.js';
import { Payee } from '../payees/routes.js';
import { approvalPolicy, categoryName, loadCategories, type ApprovalPolicy, type CategoryLookup } from '../settings/service.js';
import type { UserDoc } from '../users/model.js';
import { Expense, type ExpenseDoc } from './model.js';

registerReference('payee', async (id) => countLabel(await Expense.countDocuments({ payeeId: id }), 'expense'));
registerReference('staff', async (id) => countLabel(await Expense.countDocuments({ 'items.staffId': id }), 'salary run'));

export const KIND_LABEL: Record<ExpenseKind, string> = { expense: 'Expense', claim: 'Claim', salary: 'Salary run' };
export const KIND_PATH: Record<ExpenseKind, string> = { expense: '/expenses', claim: '/claims', salary: '/salary/runs' };

// ── Who may do what ─────────────────────────────────────────────────────────

const isClaimant = (expense: ExpenseDoc, user: UserDoc) => expense.kind === 'claim' && String(expense.claimantId) === String(user._id);

/** Staff see only their own claims. This is checked on every request, not just hidden in the menu. */
export function mayView(expense: ExpenseDoc, user: UserDoc): boolean {
  if (expense.kind === 'claim') return isClaimant(expense, user) || can(user.role, 'claims.viewAll');
  if (expense.kind === 'salary') return can(user.role, 'salary.view');
  return can(user.role, 'expenses.view');
}

/** May write, submit, withdraw or delete it. */
export function mayManage(expense: ExpenseDoc, user: UserDoc): boolean {
  if (expense.kind === 'claim') return isClaimant(expense, user) || can(user.role, 'expenses.manage');
  if (expense.kind === 'salary') return can(user.role, 'salary.manage');
  return can(user.role, 'expenses.manage');
}

export async function loadExpense(id: unknown, kind: ExpenseKind, user: UserDoc): Promise<ExpenseDoc> {
  const what = `That ${KIND_LABEL[kind].toLowerCase()}`;
  const valid = typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
  const expense = valid ? await Expense.findOne({ _id: id, kind }) : null;
  // Someone else's claim answers exactly like one that does not exist.
  if (!expense || !mayView(expense, user)) throw notFound(what);
  return expense;
}

export function assertMayManage(expense: ExpenseDoc, user: UserDoc): void {
  if (!mayManage(expense, user)) throw new AppError(403, 'You do not have access to change this.');
}

export const ownerIds = (expense: ExpenseDoc): string[] => expense.authorIds.map(String);

export function actionsFor(expense: ExpenseDoc, user: UserDoc, policy: ApprovalPolicy): ExpenseAction[] {
  const manage = mayManage(expense, user);
  const actions: ExpenseAction[] = [];
  switch (expense.status) {
    case 'draft':
      if (manage) actions.push('edit', 'delete', 'submit');
      break;
    case 'pending_approval':
      if (approvalBlocker(policy, user, ownerIds(expense), expense.approvals) === null) actions.push('approve', 'reject');
      if (manage) actions.push('edit', 'withdraw');
      break;
    case 'approved':
      if (manage) actions.push('edit', 'withdraw');
      if (can(user.role, 'expenses.pay')) actions.push('pay');
      break;
    case 'paid':
      if (can(user.role, 'expenses.reverse')) actions.push('reverse');
      break;
    case 'reversed':
      break;
  }
  return actions;
}

// ── What the reader sees ────────────────────────────────────────────────────

interface Context {
  companies: Map<string, string>;
  payees: Map<string, string>;
  categories: CategoryLookup;
  policy: ApprovalPolicy;
  user: UserDoc;
}

async function contextFor(expenses: ExpenseDoc[], user: UserDoc): Promise<Context> {
  const [companies, payees, categories, policy] = await Promise.all([
    namesOf(Company, expenses.map((expense) => expense.companyId)),
    namesOf(Payee, expenses.map((expense) => expense.payeeId)),
    loadCategories(),
    approvalPolicy(),
  ]);
  return { companies, payees, categories, policy, user };
}

function toDto(expense: ExpenseDoc, context: Context, withHistory: boolean): ExpenseDto {
  return {
    id: String(expense._id),
    number: expense.number,
    kind: expense.kind,
    status: expense.status,
    company: refOf(context.companies, expense.companyId),
    title: expense.title,
    payee: expense.payeeId ? refOf(context.payees, expense.payeeId, 'Removed payee') : null,
    claimant: expense.claimantId ? { id: String(expense.claimantId), name: expense.claimantName } : null,
    salaryMonth: expense.salaryMonth,
    expenseDate: expense.expenseDate,
    dueDate: expense.dueDate,
    items: expense.items.map((item) => ({
      description: item.description,
      categoryId: String(item.categoryId),
      categoryName: categoryName(context.categories, item.categoryId),
      amount: item.amount,
      date: item.date,
      receiptFileId: item.receiptFileId ? String(item.receiptFileId) : null,
      staffId: item.staffId ? String(item.staffId) : null,
      note: item.note,
    })),
    total: expense.total,
    notes: expense.notes,
    attachmentIds: expense.attachmentIds.map(String),
    approvals: expense.approvals.map(approvalDto),
    approvalsRequired: context.policy.required,
    rejectionReason: expense.rejectionReason,
    paidDate: expense.paidDate,
    paymentReference: expense.paymentReference,
    reversalReason: expense.reversalReason,
    activity: withHistory ? expense.activity.map(activityDto) : [],
    actions: actionsFor(expense, context.user, context.policy),
    createdBy: { id: String(expense.createdById), name: expense.createdByName },
    createdAt: expense.createdAt.toISOString(),
  };
}

export async function expenseDto(expense: ExpenseDoc, user: UserDoc): Promise<ExpenseDto> {
  return toDto(expense, await contextFor([expense], user), true);
}

/** Many records for a list; history is left out. */
export async function expenseDtos(expenses: ExpenseDoc[], user: UserDoc): Promise<ExpenseDto[]> {
  const context = await contextFor(expenses, user);
  return expenses.map((expense) => toDto(expense, context, false));
}

export function summaryRows(expense: ExpenseDoc): [string, string][] {
  return [
    [KIND_LABEL[expense.kind], expense.number],
    ['Title', expense.title],
    ...(expense.claimantName ? ([['Claimed by', expense.claimantName]] as [string, string][]) : []),
    ['Total', formatMoney(expense.total)],
  ];
}
