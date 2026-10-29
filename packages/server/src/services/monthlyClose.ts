import mongoose from 'mongoose';
import { Entity } from '../models/Entity.js';
import { Fund, type IFund } from '../models/Fund.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { MonthlyClose, type IMonthlyClose } from '../models/MonthlyClose.js';
import { PaymentRequest } from '../models/PaymentRequest.js';
import { ShareBonusUser, type IShareBonusUser } from '../models/ShareBonusUser.js';
import { Shareholder, type IShareholder } from '../models/Shareholder.js';
import { getNextSequence } from '../models/Counter.js';
import { AppError } from '../middleware/errorHandler.js';
import { hkMonthBounds } from '../utils/hkDate.js';
import { MONTH_PLAN_OPEN_REQUEST_STATUSES } from './monthPlan.js';
import { monthlyFigures, operatingCashSnapshot } from './periodFigures.js';
import { splitTakeOut, unpaidBankTotal, type TakeOutResult } from './takeOut.js';

export const STAFF_BONUS_CATEGORY = 'Staff Bonus';
export const SHAREHOLDER_DISTRIBUTION_CATEGORY = 'Shareholder Distribution';

function entityMatch(entityId?: string) {
  return entityId ? { entity: new mongoose.Types.ObjectId(entityId) } : {};
}

function refId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && '_id' in value) return String((value as { _id: unknown })._id);
  return String(value);
}

/**
 * Take-out for a period, shared by the month-plan report and month close.
 * Open bills due (or created, when undated) before `to` count as pending out.
 */
export async function buildTakeOut(entityId: string | undefined, to: Date): Promise<{
  takeOut: TakeOutResult;
  shareholders: IShareholder[];
  bonusUsers: IShareBonusUser[];
}> {
  const [requests, snapshot, shareholders, bonusUsers] = await Promise.all([
    PaymentRequest.find({
      ...entityMatch(entityId),
      status: { $in: [...MONTH_PLAN_OPEN_REQUEST_STATUSES] },
      $expr: { $lt: [{ $ifNull: ['$dueDate', '$createdAt'] }, to] },
    }).select('status totalAmount items.amount items.disbursementType'),
    operatingCashSnapshot(entityId),
    Shareholder.find({ active: true }).sort({ name: 1 }),
    ShareBonusUser.find().sort({ name: 1 }),
  ]);

  const pendingOut = unpaidBankTotal(requests.map((row) => ({
    status: row.status,
    totalAmount: row.totalAmount,
    items: row.items.map((item) => ({ amount: item.amount, disbursementType: item.disbursementType })),
  })));

  const takeOut = splitTakeOut({
    operatingCash: snapshot.operatingCash,
    pendingOut,
    bonuses: bonusUsers.map((person) => ({ name: person.name, percent: person.bonusPercent })),
    shareholders: shareholders.map((person) => ({ name: person.name, sharePercent: person.sharePercent })),
  });

  return { takeOut, shareholders, bonusUsers };
}

export interface ClosePerson {
  id: string;
  name: string;
  payee: string | null;
  userId?: string | null;
}

export interface ClosePayoutLine {
  kind: 'bonus' | 'shareholder';
  personId: string;
  userId?: string | null;
  name: string;
  percent: number;
  amount: number;
  payee: string | null;
}

export interface ClosePlan {
  direction: TakeOutResult['direction'];
  staffReserve: number;
  companyReserve: number;
  payouts: ClosePayoutLine[];
  missingPayees: Array<{ kind: 'shareholder' | 'bonus'; name: string }>;
}

/** What a close posts. Lines line up with `takeOut.bonus` / `takeOut.shareholders` by index. */
export function planClose(takeOut: TakeOutResult, bonusUsers: ClosePerson[], shareholders: ClosePerson[]): ClosePlan {
  if (takeOut.direction !== 'take_out') {
    return { direction: takeOut.direction, staffReserve: 0, companyReserve: 0, payouts: [], missingPayees: [] };
  }

  const payouts: ClosePayoutLine[] = [];
  takeOut.bonus.forEach((line, index) => {
    const person = bonusUsers[index];
    if (!person || line.amount <= 0) return;
    payouts.push({
      kind: 'bonus',
      personId: person.id,
      userId: person.userId,
      name: line.name,
      percent: line.percent,
      amount: line.amount,
      payee: person.payee,
    });
  });
  takeOut.shareholders.forEach((line, index) => {
    const person = shareholders[index];
    if (!person || line.amount <= 0) return;
    payouts.push({
      kind: 'shareholder',
      personId: person.id,
      userId: person.userId,
      name: line.name,
      percent: line.sharePercent,
      amount: line.amount,
      payee: person.payee,
    });
  });

  return {
    direction: takeOut.direction,
    staffReserve: takeOut.staffReserve,
    companyReserve: takeOut.companyReserve,
    payouts,
    missingPayees: payouts
      .filter((line) => !line.payee)
      .map((line) => ({ kind: line.kind, name: line.name })),
  };
}

export function closeBlockReason(input: {
  alreadyClosed: boolean;
  missingPayees: ClosePlan['missingPayees'];
  year: number;
  month: number;
  now?: Date;
}): string | null {
  if (input.alreadyClosed) return 'This month is already closed';
  const now = input.now ?? new Date();
  if (hkMonthBounds(input.year, input.month).from > now) return 'Cannot close a month that has not started';
  if (input.missingPayees.length > 0) {
    const names = input.missingPayees.map((person) => person.name).join(', ');
    return `Set a payee on the Shareholders page for: ${names}`;
  }
  return null;
}

export function reopenBlockReason(paymentRequestStatus: string | null | undefined): string | null {
  if (paymentRequestStatus === 'approved' || paymentRequestStatus === 'executed') {
    return `The payout request is already ${paymentRequestStatus}. Reject or delete it before reopening`;
  }
  return null;
}

function toClosePeople(docs: Array<IShareholder | IShareBonusUser>): ClosePerson[] {
  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    payee: refId(doc.payee),
    userId: refId(doc.user),
  }));
}

async function cashFundsFor(entityId: string) {
  return Fund.find({
    type: { $in: ['bank', 'petty_cash'] },
    active: true,
    $or: [{ entity: new mongoose.Types.ObjectId(entityId) }, { entity: { $exists: false } }, { entity: null }],
  }).sort({ type: 1, name: 1 });
}

function pickDefaultFund(funds: IFund[], entityId: string): IFund | null {
  const own = funds.filter((fund) => refId(fund.entity) === entityId);
  const pool = own.length > 0 ? own : funds;
  return pool.find((fund) => fund.type === 'bank') ?? pool[0] ?? null;
}

export async function findClose(entityId: string, year: number, month: number) {
  return MonthlyClose.findOne({ entity: entityId, year, month })
    .populate('closedBy', 'name')
    .populate('distributions.shareholder', 'name sharePercent')
    .populate('paymentRequest', 'requestNumber status')
    .populate('staffReserveFund', 'name')
    .populate('companyReserveFund', 'name')
    .populate('reserveHeldIn', 'name');
}

export async function previewClose(entityId: string, year: number, month: number) {
  const { to } = hkMonthBounds(year, month);
  const [{ takeOut, shareholders, bonusUsers }, funds, existing] = await Promise.all([
    buildTakeOut(entityId, to),
    cashFundsFor(entityId),
    findClose(entityId, year, month),
  ]);
  const plan = planClose(takeOut, toClosePeople(bonusUsers), toClosePeople(shareholders));
  const defaultFund = pickDefaultFund(funds, entityId);
  return {
    year,
    month,
    entity: entityId,
    takeOut,
    bankFunds: funds.map((fund) => ({
      _id: String(fund._id),
      name: fund.name,
      type: fund.type,
      balance: fund.balance || 0,
    })),
    defaultBankFund: defaultFund ? String(defaultFund._id) : null,
    missingPayees: plan.missingPayees,
    existing,
  };
}

async function ensureReserveFund(
  label: 'Staff Reserve' | 'Company Reserve',
  entity: { _id: mongoose.Types.ObjectId; code: string },
  heldIn: IFund,
): Promise<IFund> {
  const name = `${label} - ${entity.code}`;
  const existing = await Fund.findOne({ name });
  if (existing) {
    if (existing.type !== 'reserve') throw new AppError(409, `Fund "${name}" exists but is not a reserve fund`);
    if (!existing.active || refId(existing.heldIn) !== String(heldIn._id)) {
      existing.active = true;
      existing.heldIn = heldIn._id as mongoose.Types.ObjectId;
      await existing.save();
    }
    return existing;
  }
  return Fund.create({ name, type: 'reserve', entity: entity._id, heldIn: heldIn._id, openingBalance: 0, balance: 0 });
}

function monthLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function closeReference(closeId: unknown) {
  return `monthly-close:${String(closeId)}`;
}

export async function closeMonth(input: {
  entityId: string;
  year: number;
  month: number;
  reserveHeldIn: string;
  sourceBankAccount: string;
  notes?: string;
  userId: mongoose.Types.ObjectId;
}): Promise<IMonthlyClose> {
  const { entityId, year, month, userId } = input;
  const entity = await Entity.findById(entityId);
  if (!entity) throw new AppError(404, 'Entity not found');

  const { to } = hkMonthBounds(year, month);
  const [{ takeOut, shareholders, bonusUsers }, existing, figures] = await Promise.all([
    buildTakeOut(entityId, to),
    MonthlyClose.exists({ entity: entityId, year, month }),
    monthlyFigures(year, month, entityId),
  ]);
  const plan = planClose(takeOut, toClosePeople(bonusUsers), toClosePeople(shareholders));
  const blocked = closeBlockReason({ alreadyClosed: Boolean(existing), missingPayees: plan.missingPayees, year, month });
  if (blocked) throw new AppError(existing ? 409 : 400, blocked);

  const hasReserves = plan.staffReserve > 0 || plan.companyReserve > 0;
  const hasPayouts = plan.payouts.length > 0;

  let heldIn: IFund | null = null;
  if (hasReserves) {
    heldIn = await Fund.findOne({ _id: input.reserveHeldIn, type: { $in: ['bank', 'petty_cash'] }, active: true });
    if (!heldIn) throw new AppError(400, 'Choose an active bank or petty cash fund to hold the reserves');
  }
  let source: IFund | null = null;
  if (hasPayouts) {
    source = await Fund.findOne({ _id: input.sourceBankAccount, type: 'bank', active: true });
    if (!source) throw new AppError(400, 'Choose an active bank fund to pay from');
  }

  const label = monthLabel(year, month);
  const now = new Date();
  const close = new MonthlyClose({
    entity: entity._id,
    year,
    month,
    status: 'finalized',
    openingCash: figures.openingCash,
    totalIncome: figures.totalIncome,
    totalExpense: figures.totalExpense,
    netProfit: figures.netProfit,
    availableCash: takeOut.available,
    shareholderDistribution: takeOut.direction === 'take_out' ? takeOut.shareholderPool : 0,
    companyReserve: plan.companyReserve,
    staffReserve: plan.staffReserve,
    closingCash: figures.availableCash - plan.staffReserve - plan.companyReserve,
    distributions: plan.payouts
      .filter((line) => line.kind === 'shareholder')
      .map((line) => ({ shareholder: line.personId, sharePercent: line.percent, amount: line.amount, method: 'cash' })),
    bonusDistributions: plan.payouts
      .filter((line) => line.kind === 'bonus')
      .map((line) => ({ bonusUser: line.personId, user: line.userId ?? undefined, name: line.name, percent: line.percent, amount: line.amount })),
    takeOut: {
      operatingCash: takeOut.operatingCash,
      pendingOut: takeOut.pendingOut,
      available: takeOut.available,
      direction: takeOut.direction,
      bonusTotal: takeOut.bonusTotal,
      afterBonus: takeOut.afterBonus,
    },
    reserveHeldIn: heldIn?._id,
    isLoss: takeOut.direction === 'pay_in',
    closedBy: userId,
    closedAt: now,
    notes: input.notes ?? '',
    activityLog: [{ action: 'finalized', user: userId, timestamp: now }],
  });

  await close.save().catch((error: { code?: number }) => {
    if (error?.code === 11000) throw new AppError(409, 'This month is already closed');
    throw error;
  });

  const incremented: Array<{ fund: IFund; amount: number }> = [];
  try {
    if (hasReserves && heldIn) {
      const reference = closeReference(close._id);
      const reserveLines: Array<{ label: 'Staff Reserve' | 'Company Reserve'; amount: number; field: 'staffReserveFund' | 'companyReserveFund' }> = [
        { label: 'Staff Reserve', amount: plan.staffReserve, field: 'staffReserveFund' },
        { label: 'Company Reserve', amount: plan.companyReserve, field: 'companyReserveFund' },
      ];
      for (const line of reserveLines) {
        if (line.amount <= 0) continue;
        const fund = await ensureReserveFund(line.label, entity, heldIn);
        await Fund.updateOne({ _id: fund._id }, { $inc: { balance: line.amount } });
        incremented.push({ fund, amount: line.amount });
        await FundTransfer.create({
          toFund: fund._id,
          amount: line.amount,
          date: now,
          description: `${line.label} from ${entity.code} ${label} close`,
          reference,
          createdBy: userId,
        });
        close.set(line.field, fund._id);
      }
    }

    if (hasPayouts && source) {
      const requestNumber = await getNextSequence('pay');
      const request = await PaymentRequest.create({
        requestNumber,
        entity: entity._id,
        description: `${entity.code} ${label} month close payouts`,
        items: plan.payouts.map((line) => ({
          payee: line.payee,
          description: line.kind === 'bonus'
            ? `${label} staff bonus - ${line.name} (${line.percent}%)`
            : `${label} shareholder distribution - ${line.name} (${line.percent}%)`,
          amount: line.amount,
          category: line.kind === 'bonus' ? STAFF_BONUS_CATEGORY : SHAREHOLDER_DISTRIBUTION_CATEGORY,
          recipient: line.name,
          disbursementType: 'bank',
          ...(line.kind === 'shareholder' ? { shareholderId: line.personId } : {}),
        })),
        totalAmount: plan.payouts.reduce((sum, line) => sum + line.amount, 0),
        sourceBankAccount: source.name,
        status: 'pending',
        dueDate: new Date(to.getTime() - 1),
        createdBy: userId,
        activityLog: [{ action: 'created', user: userId, timestamp: now, note: `Created by ${label} month close` }],
      });
      close.paymentRequest = request._id as mongoose.Types.ObjectId;
    }

    await close.save();
  } catch (error) {
    await rollbackClose(close, incremented);
    throw error;
  }

  return close;
}

async function rollbackClose(close: IMonthlyClose, incremented: Array<{ fund: IFund; amount: number }>) {
  for (const entry of incremented) {
    await Fund.updateOne({ _id: entry.fund._id }, { $inc: { balance: -entry.amount } });
  }
  await FundTransfer.deleteMany({ reference: closeReference(close._id) });
  if (close.paymentRequest) await PaymentRequest.deleteOne({ _id: close.paymentRequest });
  await MonthlyClose.deleteOne({ _id: close._id });
}

export async function reopenMonth(closeId: string): Promise<void> {
  const close = await MonthlyClose.findById(closeId);
  if (!close) throw new AppError(404, 'Monthly close not found');

  const request = close.paymentRequest ? await PaymentRequest.findById(close.paymentRequest) : null;
  const blocked = reopenBlockReason(request?.status);
  if (blocked) throw new AppError(400, blocked);

  const transfers = await FundTransfer.find({ reference: closeReference(close._id) });
  for (const transfer of transfers) {
    if (transfer.toFund) await Fund.updateOne({ _id: transfer.toFund }, { $inc: { balance: -transfer.amount } });
  }
  await FundTransfer.deleteMany({ reference: closeReference(close._id) });
  if (request) await PaymentRequest.deleteOne({ _id: request._id });
  await MonthlyClose.deleteOne({ _id: close._id });
}
