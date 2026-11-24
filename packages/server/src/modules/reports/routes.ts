import { Router, type Request } from 'express';
import { Types } from 'mongoose';
import { hkCurrentMonth, hkToday, isValidMonth, monthBounds, type DashboardDto, type PnlBasis } from '@hbk/shared';
import { currentUser, requirePermission } from '../../platform/auth.js';
import { badRequest } from '../../platform/errors.js';
import { objectId, queryString, route } from '../../platform/http.js';
import { namesOf } from '../../platform/references.js';
import { approvalBlocker } from '../approval.js';
import { Client } from '../clients/model.js';
import { Company } from '../companies/model.js';
import { Expense } from '../expenses/model.js';
import { Invoice } from '../invoices/model.js';
import { Quote } from '../quotes/model.js';
import { approvalPolicy } from '../settings/service.js';
import { entriesFor, pnlEntries, pnlForMonth, pnlForYear, totalsOf, type Side } from './pnl.js';

const companyOf = (req: Request): string | null => {
  const companyId = queryString(req, 'companyId');
  return companyId ? String(objectId(companyId, 'That company')) : null;
};

function monthOfRequest(req: Request): string {
  const month = queryString(req, 'month') ?? hkCurrentMonth();
  if (!isValidMonth(month)) throw badRequest('Choose a month.');
  return month;
}

export const reportRouter = Router();
reportRouter.use(requirePermission('pnl.view'));

reportRouter.get(
  '/pnl',
  route(async (req, res) => {
    res.json(await pnlForMonth(monthOfRequest(req), companyOf(req)));
  }),
);

reportRouter.get(
  '/pnl/year',
  route(async (req, res) => {
    const year = Number(queryString(req, 'year') ?? hkToday().slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw badRequest('Choose a year.');
    res.json(await pnlForYear(year, companyOf(req)));
  }),
);

/** The items behind one figure on the P&L. */
reportRouter.get(
  '/pnl/entries',
  route(async (req, res) => {
    const basis = queryString(req, 'basis');
    const side = queryString(req, 'side');
    if (basis !== 'cash' && basis !== 'billed') throw badRequest('Choose cash or billed.');
    if (side !== 'income' && side !== 'expense') throw badRequest('Choose income or expenses.');
    const categoryId = queryString(req, 'categoryId');
    res.json(
      await pnlEntries(monthOfRequest(req), basis as PnlBasis, side as Side, categoryId ? String(objectId(categoryId, 'That category')) : null, companyOf(req)),
    );
  }),
);

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requirePermission('dashboard.view'),
  route(async (req, res) => {
    const user = currentUser(req);
    const companyId = companyOf(req);
    const company = companyId ? { companyId: new Types.ObjectId(companyId) } : {};
    const today = hkToday();
    const month = hkCurrentMonth();
    const range = monthBounds(month);

    const [cash, billed, openInvoices, quotes, waiting, approved, policy, hasCompany] = await Promise.all([
      entriesFor('cash', range, companyId),
      entriesFor('billed', range, companyId),
      Invoice.find({ ...company, status: { $in: ['unpaid', 'partial'] } }).select('number clientId dueDate total amountPaid').lean(),
      Quote.find({ ...company, status: 'pending_approval' }).sort({ createdAt: 1 }),
      Expense.find({ ...company, status: 'pending_approval' }).sort({ createdAt: 1 }),
      Expense.find({ ...company, status: 'approved' }).select('kind number title total dueDate').lean(),
      approvalPolicy(),
      Company.exists({ active: true }),
    ]);

    const clients = await namesOf(Client, openInvoices.map((invoice) => invoice.clientId));
    const owed = openInvoices
      .map((invoice) => ({
        id: String(invoice._id),
        number: invoice.number,
        clientName: clients.get(String(invoice.clientId)) ?? 'Removed client',
        dueDate: invoice.dueDate,
        amountDue: invoice.total - invoice.amountPaid,
        overdue: invoice.dueDate !== null && invoice.dueDate < today,
      }))
      // Soonest due first; invoices without a due date last.
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.number.localeCompare(b.number));
    const overdue = owed.filter((invoice) => invoice.overdue);
    const sum = (rows: { amountDue: number }[]) => rows.reduce((total, row) => total + row.amountDue, 0);

    // "mine" marks what this person can approve right now.
    const mine = (authorIds: unknown[], approvals: Parameters<typeof approvalBlocker>[3]) =>
      approvalBlocker(policy, user, authorIds.map(String), approvals) === null;

    const dashboard: DashboardDto = {
      month,
      cash: totalsOf(cash),
      billed: totalsOf(billed),
      unpaidInvoices: { count: owed.length, total: sum(owed), overdueCount: overdue.length, overdueTotal: sum(overdue), items: owed.slice(0, 8) },
      waitingForApproval: [
        ...quotes.map((quote) => ({
          kind: 'quote' as const,
          id: String(quote._id),
          number: quote.number,
          title: quote.title,
          total: quote.total,
          mine: mine(quote.authorIds, quote.approvals),
        })),
        ...waiting.map((expense) => ({
          kind: expense.kind,
          id: String(expense._id),
          number: expense.number,
          title: expense.title,
          total: expense.total,
          mine: mine(expense.authorIds, expense.approvals),
        })),
      ],
      waitingForPayment: approved
        .map((expense) => ({ kind: expense.kind, id: String(expense._id), number: expense.number, title: expense.title, total: expense.total, dueDate: expense.dueDate }))
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.number.localeCompare(b.number)),
      recurringDue: [],
      setup: { hasCompany: hasCompany !== null, hasApprovers: policy.approverIds.length > 0 },
    };
    res.json(dashboard);
  }),
);
