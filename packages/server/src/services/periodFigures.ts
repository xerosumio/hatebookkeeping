import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Fund } from '../models/Fund.js';
import { MonthlyClose } from '../models/MonthlyClose.js';
import { Entity } from '../models/Entity.js';
import { hkMonthBounds, hkInstant } from '../utils/hkDate.js';

export const PL_EXCLUDED_CATEGORIES = ['Currency Conversion'] as const;

export interface PeriodQuery {
  from: Date;
  to: Date;
  entityId?: string;
}

export interface PlTotals {
  income: number;
  expense: number;
  net: number;
}

export interface CashTotals {
  cashIn: number;
  cashOut: number;
  cashNet: number;
}

export interface PlCategoryLine {
  category: string;
  total: number;
  count: number;
}

export interface MonthlyFigures {
  openingCash: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  cashFlow: number;
  availableCash: number;
}

export interface FundLine {
  name: string;
  type: string;
  balance: number;
}

export interface OperatingSnapshot {
  bankPettyTotal: number;
  earmarkedReserves: number;
  operatingCash: number;
  standaloneReserves: number;
  cashBreakdown: FundLine[];
  earmarkedBreakdown: FundLine[];
  standaloneBreakdown: FundLine[];
}

export function isPlCategory(category: string): boolean {
  return !(PL_EXCLUDED_CATEGORIES as readonly string[]).includes(category);
}

export function isCashMovement(txn: { type: string; bankAccount?: string | null }): boolean {
  if (txn.type === 'income') return true;
  if (txn.type === 'expense') return Boolean(txn.bankAccount);
  return false;
}

/** First-month opening = operating cash now, minus net cash from this month onward. */
export function openingFromOperatingAndForwardCash(
  operatingNow: number,
  cashIn: number,
  cashOut: number,
): number {
  return operatingNow - (cashIn - cashOut);
}

function entityObjectId(entityId?: string) {
  return entityId ? { entity: new mongoose.Types.ObjectId(entityId) } : {};
}

export function cashMatch(from: Date, to: Date, entityId?: string): Record<string, unknown> {
  return {
    date: { $gte: from, $lt: to },
    ...entityObjectId(entityId),
    $or: [
      { type: 'income' },
      { type: 'expense', bankAccount: { $nin: [null, ''] } },
    ],
  };
}

function totalsFromTypeAgg(rows: { _id: string; total: number }[]): PlTotals {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r._id === 'income') income = r.total;
    if (r._id === 'expense') expense = r.total;
  }
  return { income, expense, net: income - expense };
}

export async function queryPl({ from, to, entityId }: PeriodQuery): Promise<PlTotals> {
  const rows = await Transaction.aggregate([
    { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
    {
      $match: {
        _effectiveDate: { $gte: from, $lt: to },
        category: { $nin: [...PL_EXCLUDED_CATEGORIES] },
        ...entityObjectId(entityId),
      },
    },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  return totalsFromTypeAgg(rows);
}

export async function queryPlByCategory({ from, to, entityId }: PeriodQuery): Promise<{
  income: PlCategoryLine[];
  expenses: PlCategoryLine[];
  totals: PlTotals;
}> {
  const rows = await Transaction.aggregate([
    { $addFields: { _effectiveDate: { $ifNull: ['$accountingDate', '$date'] } } },
    {
      $match: {
        _effectiveDate: { $gte: from, $lt: to },
        category: { $nin: [...PL_EXCLUDED_CATEGORIES] },
        ...entityObjectId(entityId),
      },
    },
    {
      $group: {
        _id: { type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.type': 1, total: -1 } },
  ]);

  const income: PlCategoryLine[] = [];
  const expenses: PlCategoryLine[] = [];
  for (const r of rows) {
    const entry = { category: r._id.category as string, total: r.total as number, count: r.count as number };
    if (r._id.type === 'income') income.push(entry);
    else expenses.push(entry);
  }
  const totals: PlTotals = {
    income: income.reduce((s, i) => s + i.total, 0),
    expense: expenses.reduce((s, i) => s + i.total, 0),
    net: 0,
  };
  totals.net = totals.income - totals.expense;
  return { income, expenses, totals };
}

export async function queryCash({ from, to, entityId }: PeriodQuery): Promise<CashTotals> {
  const rows = await Transaction.aggregate([
    { $match: cashMatch(from, to, entityId) },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  const pl = totalsFromTypeAgg(rows);
  return { cashIn: pl.income, cashOut: pl.expense, cashNet: pl.net };
}

export async function operatingCashSnapshot(entityId?: string): Promise<OperatingSnapshot> {
  const entityFilter = entityObjectId(entityId);
  const cashFunds = await Fund.find({
    ...entityFilter,
    type: { $in: ['bank', 'petty_cash'] },
    active: true,
  }).sort({ type: 1, name: 1 });

  const cashBreakdown: FundLine[] = cashFunds.map((f) => ({
    name: f.name,
    type: f.type,
    balance: f.balance || 0,
  }));
  const bankPettyTotal = cashBreakdown.reduce((s, f) => s + f.balance, 0);
  const cashIds = cashFunds.map((f) => f._id);

  const earmarkedFunds = cashIds.length
    ? await Fund.find({ heldIn: { $in: cashIds }, type: 'reserve', active: true }).sort({ name: 1 })
    : [];
  const earmarkedBreakdown: FundLine[] = earmarkedFunds.map((f) => ({
    name: f.name,
    type: f.type,
    balance: f.balance || 0,
  }));
  const earmarkedReserves = earmarkedBreakdown.reduce((s, f) => s + f.balance, 0);

  const standaloneFunds = await Fund.find({
    ...entityFilter,
    type: 'reserve',
    active: true,
    $or: [{ heldIn: { $exists: false } }, { heldIn: null }],
  }).sort({ name: 1 });
  const standaloneBreakdown: FundLine[] = standaloneFunds.map((f) => ({
    name: f.name,
    type: f.type,
    balance: f.balance || 0,
  }));
  const standaloneReserves = standaloneBreakdown.reduce((s, f) => s + f.balance, 0);

  return {
    bankPettyTotal,
    earmarkedReserves,
    operatingCash: bankPettyTotal - earmarkedReserves,
    standaloneReserves,
    cashBreakdown,
    earmarkedBreakdown,
    standaloneBreakdown,
  };
}

export async function openingOperatingCash(year: number, month: number, entityId: string): Promise<number> {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevYear--;
    prevMonth = 12;
  }

  const priorClose = await MonthlyClose.findOne({
    entity: entityId,
    year: prevYear,
    month: prevMonth,
    status: 'finalized',
  });

  if (priorClose) {
    return priorClose.closingCash;
  }

  const snapshot = await operatingCashSnapshot(entityId);
  const { from } = hkMonthBounds(year, month);
  const forward = await queryCash({ from, to: hkInstant(2100, 1, 1), entityId });
  return openingFromOperatingAndForwardCash(snapshot.operatingCash, forward.cashIn, forward.cashOut);
}

export async function monthlyFigures(year: number, month: number, entityId: string): Promise<MonthlyFigures> {
  const { from, to } = hkMonthBounds(year, month);
  const [pl, cash, openingCash] = await Promise.all([
    queryPl({ from, to, entityId }),
    queryCash({ from, to, entityId }),
    openingOperatingCash(year, month, entityId),
  ]);

  const cashFlow = cash.cashNet;
  return {
    openingCash,
    totalIncome: pl.income,
    totalExpense: pl.expense,
    netProfit: pl.net,
    cashIn: cash.cashIn,
    cashOut: cash.cashOut,
    cashFlow,
    availableCash: openingCash + cashFlow,
  };
}

export async function monthlyFiguresAllEntities(year: number, month: number): Promise<MonthlyFigures> {
  const entities = await Entity.find({ active: true }).select('_id');
  if (entities.length === 0) {
    const { from, to } = hkMonthBounds(year, month);
    const far = hkInstant(2100, 1, 1);
    const [pl, cash, snapshot, forward] = await Promise.all([
      queryPl({ from, to }),
      queryCash({ from, to }),
      operatingCashSnapshot(),
      queryCash({ from, to: far }),
    ]);
    const openingCash = openingFromOperatingAndForwardCash(
      snapshot.operatingCash,
      forward.cashIn,
      forward.cashOut,
    );
    return {
      openingCash,
      totalIncome: pl.income,
      totalExpense: pl.expense,
      netProfit: pl.net,
      cashIn: cash.cashIn,
      cashOut: cash.cashOut,
      cashFlow: cash.cashNet,
      availableCash: openingCash + cash.cashNet,
    };
  }

  const parts = await Promise.all(entities.map((e) => monthlyFigures(year, month, e._id.toString())));
  return parts.reduce(
    (acc, f) => ({
      openingCash: acc.openingCash + f.openingCash,
      totalIncome: acc.totalIncome + f.totalIncome,
      totalExpense: acc.totalExpense + f.totalExpense,
      netProfit: acc.netProfit + f.netProfit,
      cashIn: acc.cashIn + f.cashIn,
      cashOut: acc.cashOut + f.cashOut,
      cashFlow: acc.cashFlow + f.cashFlow,
      availableCash: acc.availableCash + f.availableCash,
    }),
    {
      openingCash: 0,
      totalIncome: 0,
      totalExpense: 0,
      netProfit: 0,
      cashIn: 0,
      cashOut: 0,
      cashFlow: 0,
      availableCash: 0,
    },
  );
}
