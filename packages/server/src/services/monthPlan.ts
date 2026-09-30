import {
  hkInclusiveRange,
  hkMonthBounds,
  hkTodayYmd,
  parseYmd,
} from '../utils/hkDate.js';

export const MONTH_PLAN_INVOICE_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export const MONTH_PLAN_OPEN_INVOICE_STATUSES = ['unpaid', 'partial'] as const;
export const MONTH_PLAN_REQUEST_STATUSES = ['pending', 'approved', 'executed'] as const;
export const MONTH_PLAN_OPEN_REQUEST_STATUSES = ['pending', 'approved'] as const;

const monthInvoiceStatuses = new Set<string>(MONTH_PLAN_INVOICE_STATUSES);
const openInvoiceStatuses = new Set<string>(MONTH_PLAN_OPEN_INVOICE_STATUSES);
const monthRequestStatuses = new Set<string>(MONTH_PLAN_REQUEST_STATUSES);
const openRequestStatuses = new Set<string>(MONTH_PLAN_OPEN_REQUEST_STATUSES);

export class PlanBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanBoundsError';
  }
}

export interface PlanBoundsInput {
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
}

/** `startDate`+`endDate` win. Otherwise `year`+`month` is that Hong Kong calendar month. */
export function resolvePlanBounds(input: PlanBoundsInput, now = new Date()): { from: Date; to: Date } {
  const startDate = input.startDate?.trim() || undefined;
  const endDate = input.endDate?.trim() || undefined;
  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new PlanBoundsError('startDate and endDate are both required');
    }
    let range: { from: Date; to: Date };
    try {
      range = hkInclusiveRange(startDate, endDate);
    } catch {
      throw new PlanBoundsError('startDate and endDate must be YYYY-MM-DD');
    }
    if (range.from.getTime() >= range.to.getTime()) {
      throw new PlanBoundsError('endDate must be on or after startDate');
    }
    return range;
  }

  const today = parseYmd(hkTodayYmd(now));
  const year = input.year ?? today.year;
  const month = input.month ?? today.month;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new PlanBoundsError('month must be 1-12');
  }
  return hkMonthBounds(year, month);
}

export interface MonthPlanSourceInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  invoiceDate: Date;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: string;
}

export interface MonthPlanSourceRequest {
  id: string;
  requestNumber: string;
  description: string;
  payeeNames: string[];
  createdAt: Date;
  dueDate?: Date | null;
  totalAmount: number;
  status: string;
  items?: Array<{ category: string; amount: number }>;
}

export interface MonthPlanInvoiceLine {
  id: string;
  invoiceNumber: string;
  clientName: string;
  invoiceDate: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: string;
}

export interface MonthPlanRequestLine {
  id: string;
  requestNumber: string;
  description: string;
  payeeNames: string[];
  dueDate: string;
  amount: number;
  status: string;
}

export interface MonthPlanCategoryLine {
  category: string;
  total: number;
  count: number;
}

export interface MonthPlanBody {
  incoming: {
    billed: number;
    collected: number;
    pending: number;
    count: number;
    items: MonthPlanInvoiceLine[];
  };
  outgoing: {
    committed: number;
    paid: number;
    pending: number;
    count: number;
    items: MonthPlanRequestLine[];
  };
  carryover: {
    receivable: { total: number; count: number; items: MonthPlanInvoiceLine[] };
    payable: { total: number; count: number; items: MonthPlanRequestLine[] };
  };
  plan: {
    pendingIn: number;
    pendingOut: number;
    net: number;
  };
  /** Income is invoices dated in the period. Expenses are bills due in the period. */
  pl: {
    income: MonthPlanCategoryLine[];
    expenses: MonthPlanCategoryLine[];
    totals: { income: number; expense: number; net: number };
  };
}

function inMonth(date: Date, from: Date, to: Date): boolean {
  const time = date.getTime();
  return time >= from.getTime() && time < to.getTime();
}

function invoiceLine(inv: MonthPlanSourceInvoice): MonthPlanInvoiceLine {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    invoiceDate: inv.invoiceDate.toISOString(),
    total: inv.total,
    amountPaid: inv.amountPaid,
    amountDue: inv.amountDue,
    status: inv.status,
  };
}

/** Due date when set; otherwise the day the request was created. */
export function requestPlanDate(row: { dueDate?: Date | null; createdAt: Date }): Date {
  return row.dueDate ?? row.createdAt;
}

function requestLine(row: MonthPlanSourceRequest): MonthPlanRequestLine {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    description: row.description,
    payeeNames: row.payeeNames,
    dueDate: requestPlanDate(row).toISOString(),
    amount: row.totalAmount,
    status: row.status,
  };
}

function addCategory(totals: Map<string, MonthPlanCategoryLine>, category: string, amount: number) {
  const key = category.trim() || 'Uncategorized';
  const row = totals.get(key) ?? { category: key, total: 0, count: 0 };
  row.total += amount;
  row.count += 1;
  totals.set(key, row);
}

function categoryLines(totals: Map<string, MonthPlanCategoryLine>): MonthPlanCategoryLine[] {
  return [...totals.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

/** Bills in the period, grouped by line category. The sum matches the committed total. */
function expenseLines(rows: MonthPlanSourceRequest[]): MonthPlanCategoryLine[] {
  const totals = new Map<string, MonthPlanCategoryLine>();
  for (const row of rows) {
    const items = row.items ?? [];
    if (items.length === 0) {
      addCategory(totals, 'Uncategorized', row.totalAmount);
      continue;
    }
    let itemSum = 0;
    for (const item of items) {
      addCategory(totals, item.category, item.amount);
      itemSum += item.amount;
    }
    const gap = row.totalAmount - itemSum;
    if (gap !== 0) addCategory(totals, 'Uncategorized', gap);
  }
  return categoryLines(totals);
}

function byDateThenLabel(dateA: Date, dateB: Date, labelA: string, labelB: string): number {
  const diff = dateA.getTime() - dateB.getTime();
  if (diff !== 0) return diff;
  return labelA.localeCompare(labelB);
}

/** Bucket invoices by invoice date and payment requests by due date. */
export function buildMonthPlan(
  invoices: MonthPlanSourceInvoice[],
  requests: MonthPlanSourceRequest[],
  bounds: { from: Date; to: Date },
): MonthPlanBody {
  const { from, to } = bounds;

  const monthInvoices = invoices
    .filter((inv) => monthInvoiceStatuses.has(inv.status) && inMonth(inv.invoiceDate, from, to))
    .sort((a, b) => byDateThenLabel(a.invoiceDate, b.invoiceDate, a.invoiceNumber, b.invoiceNumber));

  const carryInvoices = invoices
    .filter((inv) => openInvoiceStatuses.has(inv.status) && inv.invoiceDate.getTime() < from.getTime())
    .sort((a, b) => byDateThenLabel(a.invoiceDate, b.invoiceDate, a.invoiceNumber, b.invoiceNumber));

  const monthRequests = requests
    .filter((row) => monthRequestStatuses.has(row.status) && inMonth(requestPlanDate(row), from, to))
    .sort((a, b) => byDateThenLabel(requestPlanDate(a), requestPlanDate(b), a.requestNumber, b.requestNumber));

  const carryRequests = requests
    .filter((row) => openRequestStatuses.has(row.status) && requestPlanDate(row).getTime() < from.getTime())
    .sort((a, b) => byDateThenLabel(requestPlanDate(a), requestPlanDate(b), a.requestNumber, b.requestNumber));

  const incomingItems = monthInvoices.map(invoiceLine);
  const incoming = {
    billed: incomingItems.reduce((sum, row) => sum + row.total, 0),
    collected: incomingItems.reduce((sum, row) => sum + row.amountPaid, 0),
    pending: incomingItems.reduce((sum, row) => sum + row.amountDue, 0),
    count: incomingItems.length,
    items: incomingItems,
  };

  const outgoingItems = monthRequests.map(requestLine);
  const outgoing = {
    committed: outgoingItems.reduce((sum, row) => sum + row.amount, 0),
    paid: outgoingItems.reduce((sum, row) => sum + (row.status === 'executed' ? row.amount : 0), 0),
    pending: outgoingItems.reduce((sum, row) => sum + (openRequestStatuses.has(row.status) ? row.amount : 0), 0),
    count: outgoingItems.length,
    items: outgoingItems,
  };

  const receivableItems = carryInvoices.map(invoiceLine);
  const payableItems = carryRequests.map(requestLine);
  const carryover = {
    receivable: {
      total: receivableItems.reduce((sum, row) => sum + row.amountDue, 0),
      count: receivableItems.length,
      items: receivableItems,
    },
    payable: {
      total: payableItems.reduce((sum, row) => sum + row.amount, 0),
      count: payableItems.length,
      items: payableItems,
    },
  };

  const pendingIn = incoming.pending + carryover.receivable.total;
  const pendingOut = outgoing.pending + carryover.payable.total;
  const incomeTotal = incoming.billed;
  const expenseTotal = outgoing.committed;

  return {
    incoming,
    outgoing,
    carryover,
    plan: {
      pendingIn,
      pendingOut,
      net: pendingIn - pendingOut,
    },
    pl: {
      income: incomeTotal === 0 ? [] : [{ category: 'Revenue', total: incomeTotal, count: incoming.count }],
      expenses: expenseLines(monthRequests),
      totals: {
        income: incomeTotal,
        expense: expenseTotal,
        net: incomeTotal - expenseTotal,
      },
    },
  };
}
