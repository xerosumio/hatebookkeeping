import { Types } from 'mongoose';
import {
  monthBounds,
  monthOf,
  monthsOfYear,
  type PnlBasis,
  type PnlEntryDto,
  type PnlEntrySource,
  type PnlMonthDto,
  type PnlSideDto,
  type PnlTotalsDto,
  type PnlYearDto,
} from '@hbk/shared';
import { namesOf } from '../../platform/references.js';
import { Client } from '../clients/model.js';
import { Expense } from '../expenses/model.js';
import { Invoice, Payment } from '../invoices/model.js';
import { OtherIncome } from '../otherIncome/routes.js';
import { Payee } from '../payees/routes.js';
import { getSettings, systemCategoryId, type CategoryLookup, categoryLookup } from '../settings/service.js';

/**
 * The P&L is not stored anywhere. Every figure is the sum of a list of
 * entries read straight from invoices, payments, other income and expenses,
 * and the page that shows a figure can ask for exactly that list. So a total
 * and the items behind it cannot disagree.
 *
 *   Cash in / out       payments received, by the day received; expenses,
 *                       claims and salary, by the day they were paid.
 *   Billed / committed  invoices, by invoice date (not drafts or cancelled);
 *                       expenses, claims and salary once approved, by the
 *                       expense date, the receipt date or the salary month.
 *
 * Other income counts on the day received on both. Reversed items and voided
 * payments count on neither. Dates are Hong Kong days.
 */

export type Side = 'income' | 'expense';

export interface Entry extends PnlEntryDto {
  side: Side;
  categoryId: string;
}

/** `from` is included; `to` is not. */
export interface Range {
  from: string;
  to: string;
}

const within = (range: Range) => ({ $gte: range.from, $lt: range.to });
const inRange = (date: string, range: Range) => date >= range.from && date < range.to;

export async function entriesFor(basis: PnlBasis, range: Range, companyId: string | null): Promise<Entry[]> {
  const company = companyId ? { companyId: new Types.ObjectId(companyId) } : {};
  const settings = await getSettings();
  const sales = systemCategoryId(settings, 'sales');
  const entries: Entry[] = [];

  // ── Income from invoices ──
  if (basis === 'cash') {
    const payments = await Payment.find({ ...company, voided: false, date: within(range) }).lean();
    const [invoices, clients] = await Promise.all([
      Invoice.find({ _id: { $in: payments.map((payment) => payment.invoiceId) } }).select('number title').lean(),
      namesOf(Client, payments.map((payment) => payment.clientId)),
    ]);
    const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]));
    for (const payment of payments) {
      const invoice = invoiceById.get(String(payment.invoiceId));
      entries.push({
        side: 'income',
        categoryId: sales,
        source: 'payment',
        documentId: String(payment.invoiceId),
        number: payment.number,
        date: payment.date,
        description: `Payment on ${invoice?.number ?? 'an invoice'}${invoice?.title ? ` · ${invoice.title}` : ''}`,
        counterparty: clients.get(String(payment.clientId)) ?? 'Removed client',
        amount: payment.amount,
      });
    }
  } else {
    const invoices = await Invoice.find({ ...company, status: { $in: ['unpaid', 'partial', 'paid'] }, issueDate: within(range) }).lean();
    const clients = await namesOf(Client, invoices.map((invoice) => invoice.clientId));
    for (const invoice of invoices) {
      entries.push({
        side: 'income',
        categoryId: sales,
        source: 'invoice',
        documentId: String(invoice._id),
        number: invoice.number,
        date: invoice.issueDate,
        description: invoice.title || 'Invoice',
        counterparty: clients.get(String(invoice.clientId)) ?? 'Removed client',
        amount: invoice.total,
      });
    }
  }

  // ── Other income: the same on both bases ──
  const otherIncome = await OtherIncome.find({ ...company, date: within(range) }).lean();
  for (const income of otherIncome) {
    entries.push({
      side: 'income',
      categoryId: String(income.categoryId),
      source: 'other_income',
      documentId: String(income._id),
      number: '',
      date: income.date,
      description: income.description,
      counterparty: '',
      amount: income.amount,
    });
  }

  // ── Expenses, claims and salary ──
  const expenses = await Expense.find(
    basis === 'cash'
      ? { ...company, status: 'paid', paidDate: within(range) }
      : { ...company, status: { $in: ['approved', 'paid'] }, 'items.date': within(range) },
  ).lean();
  const payees = await namesOf(Payee, expenses.map((expense) => expense.payeeId));
  for (const expense of expenses) {
    for (const item of expense.items) {
      const date = basis === 'cash' ? (expense.paidDate as string) : item.date;
      // A zero line (someone left off this month's salary) is not an item behind any figure.
      if (!inRange(date, range) || item.amount === 0) continue;
      const salary = expense.kind === 'salary';
      entries.push({
        side: 'expense',
        categoryId: String(item.categoryId),
        source: expense.kind as PnlEntrySource,
        documentId: String(expense._id),
        number: expense.number,
        date,
        // A salary line is described by who it pays; other lines by what was bought.
        description: salary ? expense.title : item.description,
        counterparty: salary ? item.description : expense.kind === 'claim' ? expense.claimantName : (payees.get(String(expense.payeeId)) ?? 'Removed payee'),
        amount: item.amount,
      });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
}

const sum = (entries: readonly Entry[]) => entries.reduce((total, entry) => total + entry.amount, 0);

export function totalsOf(entries: readonly Entry[]): PnlTotalsDto {
  const income = sum(entries.filter((entry) => entry.side === 'income'));
  const expenses = sum(entries.filter((entry) => entry.side === 'expense'));
  return { income, expenses, net: income - expenses };
}

function sideOf(entries: readonly Entry[], categories: CategoryLookup): PnlSideDto {
  const lines = (side: Side) => {
    const byCategory = new Map<string, number>();
    for (const entry of entries) {
      if (entry.side === side) byCategory.set(entry.categoryId, (byCategory.get(entry.categoryId) ?? 0) + entry.amount);
    }
    // Listed in the order the categories appear in Settings; anything since removed goes last.
    const order = [...categories.keys()];
    return [...byCategory.entries()]
      .map(([categoryId, amount]) => ({ categoryId, name: categories.get(categoryId)?.name ?? 'Removed category', amount }))
      .sort((a, b) => (order.indexOf(a.categoryId) + 1 || Infinity) - (order.indexOf(b.categoryId) + 1 || Infinity));
  };
  const totals = totalsOf(entries);
  return { income: lines('income'), expenses: lines('expense'), totalIncome: totals.income, totalExpenses: totals.expenses, net: totals.net };
}

export async function pnlForMonth(month: string, companyId: string | null): Promise<PnlMonthDto> {
  const range = monthBounds(month);
  const [cash, billed, settings] = await Promise.all([entriesFor('cash', range, companyId), entriesFor('billed', range, companyId), getSettings()]);
  const categories = categoryLookup(settings);
  return { month, companyId, cash: sideOf(cash, categories), billed: sideOf(billed, categories) };
}

export async function pnlForYear(year: number, companyId: string | null): Promise<PnlYearDto> {
  const months = monthsOfYear(year);
  const range = { from: `${year}-01-01`, to: `${year + 1}-01-01` };
  const [cash, billed] = await Promise.all([entriesFor('cash', range, companyId), entriesFor('billed', range, companyId)]);
  const inMonth = (entries: Entry[], month: string) => entries.filter((entry) => monthOf(entry.date) === month);
  return {
    year,
    companyId,
    months: months.map((month) => ({ month, cash: totalsOf(inMonth(cash, month)), billed: totalsOf(inMonth(billed, month)) })),
    cash: totalsOf(cash),
    billed: totalsOf(billed),
  };
}

/** The items behind one figure: a category line, or a whole side when no category is given. */
export async function pnlEntries(month: string, basis: PnlBasis, side: Side, categoryId: string | null, companyId: string | null): Promise<PnlEntryDto[]> {
  const entries = await entriesFor(basis, monthBounds(month), companyId);
  return entries
    .filter((entry) => entry.side === side && (categoryId === null || entry.categoryId === categoryId))
    .map(({ source, documentId, number, date, description, counterparty, amount }) => ({ source, documentId, number, date, description, counterparty, amount }));
}
