export interface TakeOutBonusInput {
  name: string;
  percent: number;
}

export interface TakeOutShareInput {
  name: string;
  sharePercent: number;
}

export interface TakeOutBill {
  status: string;
  totalAmount: number;
  items?: Array<{ amount: number; disbursementType?: string }>;
}

export interface TakeOutBonusLine {
  name: string;
  percent: number;
  amount: number;
}

export interface TakeOutShareLine {
  name: string;
  sharePercent: number;
  amount: number;
}

export type TakeOutDirection = 'pay_in' | 'take_out' | 'even';

export interface TakeOutResult {
  operatingCash: number;
  pendingOut: number;
  available: number;
  direction: TakeOutDirection;
  bonusExceedsCash: boolean;
  bonus: TakeOutBonusLine[];
  bonusTotal: number;
  afterBonus: number;
  staffReserve: number;
  companyReserve: number;
  shareholderPool: number;
  unassignedShareholderPool: number;
  shareholders: TakeOutShareLine[];
}

const OPEN_BILL_STATUSES = new Set(['pending', 'approved']);

/** Bank lines on unpaid and approved bills. A bill with no lines counts its total as bank. */
export function unpaidBankTotal(bills: TakeOutBill[]): number {
  let total = 0;
  for (const bill of bills) {
    if (!OPEN_BILL_STATUSES.has(bill.status)) continue;
    const items = bill.items ?? [];
    if (items.length === 0) {
      total += bill.totalAmount;
      continue;
    }
    for (const item of items) {
      if (item.disbursementType === 'liability_offset') continue;
      total += item.amount;
    }
  }
  return total;
}

function roundPercent(total: number, percent: number): number {
  return Math.round((total * percent) / 100);
}

/** Nearest cent, then the last positive-weight line absorbs the rounding difference. */
function allocateByWeight(total: number, weights: number[]): number[] {
  if (weights.length === 0 || total <= 0) return weights.map(() => 0);
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) return weights.map(() => 0);
  const amounts = weights.map((weight) => Math.round((total * weight) / sum));
  const drift = total - amounts.reduce((acc, amount) => acc + amount, 0);
  for (let index = amounts.length - 1; index >= 0; index -= 1) {
    if (weights[index] > 0) {
      amounts[index] += drift;
      break;
    }
  }
  return amounts;
}

function shareSplit(shareholders: TakeOutShareInput[], pool: number): {
  unassigned: number;
  lines: TakeOutShareLine[];
} {
  const weights = shareholders.map((person) => person.sharePercent);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const amounts = weightSum > 0 ? allocateByWeight(pool, weights) : weights.map(() => 0);
  return {
    unassigned: weightSum > 0 ? 0 : pool,
    lines: shareholders.map((person, index) => ({
      name: person.name,
      sharePercent: person.sharePercent,
      amount: amounts[index] ?? 0,
    })),
  };
}

function emptyBonus(bonuses: TakeOutBonusInput[]): TakeOutBonusLine[] {
  return bonuses.map((person) => ({ name: person.name, percent: person.percent, amount: 0 }));
}

export function splitTakeOut(input: {
  operatingCash: number;
  pendingOut: number;
  bonuses: TakeOutBonusInput[];
  shareholders: TakeOutShareInput[];
}): TakeOutResult {
  const available = input.operatingCash - input.pendingOut;
  if (available <= 0) {
    const owed = available < 0 ? shareSplit(input.shareholders, -available) : shareSplit(input.shareholders, 0);
    return {
      operatingCash: input.operatingCash,
      pendingOut: input.pendingOut,
      available,
      direction: available < 0 ? 'pay_in' : 'even',
      bonusExceedsCash: false,
      bonus: emptyBonus(input.bonuses),
      bonusTotal: 0,
      afterBonus: 0,
      staffReserve: 0,
      companyReserve: 0,
      shareholderPool: 0,
      unassignedShareholderPool: owed.unassigned,
      shareholders: owed.lines,
    };
  }

  const percentSum = input.bonuses.reduce((sum, person) => sum + person.percent, 0);
  const bonusExceedsCash = percentSum > 100;
  let bonusAmounts: number[];
  if (bonusExceedsCash) {
    bonusAmounts = allocateByWeight(available, input.bonuses.map((person) => person.percent));
  } else {
    bonusAmounts = input.bonuses.map((person) => roundPercent(available, person.percent));
    let over = bonusAmounts.reduce((sum, amount) => sum + amount, 0) - available;
    for (let index = bonusAmounts.length - 1; index >= 0 && over > 0; index -= 1) {
      const cut = Math.min(bonusAmounts[index], over);
      bonusAmounts[index] -= cut;
      over -= cut;
    }
  }

  const bonus = input.bonuses.map((person, index) => ({
    name: person.name,
    percent: person.percent,
    amount: bonusAmounts[index] ?? 0,
  }));
  const bonusTotal = bonus.reduce((sum, person) => sum + person.amount, 0);
  const afterBonus = bonusExceedsCash ? 0 : available - bonusTotal;
  const staffReserve = roundPercent(afterBonus, 5);
  const afterStaff = afterBonus - staffReserve;
  const companyReserve = roundPercent(afterStaff, 30);
  const shareholderPool = afterStaff - companyReserve;
  const shares = shareSplit(input.shareholders, shareholderPool);

  return {
    operatingCash: input.operatingCash,
    pendingOut: input.pendingOut,
    available,
    direction: 'take_out',
    bonusExceedsCash,
    bonus,
    bonusTotal,
    afterBonus,
    staffReserve,
    companyReserve,
    shareholderPool,
    unassignedShareholderPool: shares.unassigned,
    shareholders: shares.lines,
  };
}
