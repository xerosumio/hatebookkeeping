import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitTakeOut, unpaidBankTotal } from './takeOut.js';

const holders = [
  { name: 'William', sharePercent: 60 },
  { name: 'Andy', sharePercent: 40 },
];

describe('unpaidBankTotal', () => {
  it('counts open bank lines and skips liability offsets and settled bills', () => {
    const total = unpaidBankTotal([
      {
        status: 'pending',
        totalAmount: 5_000,
        items: [
          { amount: 3_000, disbursementType: 'bank' },
          { amount: 2_000, disbursementType: 'liability_offset' },
        ],
      },
      { status: 'approved', totalAmount: 1_500, items: [] },
      { status: 'executed', totalAmount: 9_000, items: [{ amount: 9_000, disbursementType: 'bank' }] },
      { status: 'pending', totalAmount: 800, items: [{ amount: 800 }] },
    ]);
    assert.equal(total, 3_000 + 1_500 + 800);
  });
});

describe('splitTakeOut', () => {
  it('splits a shortfall across shareholders by ownership', () => {
    const result = splitTakeOut({
      operatingCash: 4_000,
      pendingOut: 9_000,
      bonuses: [{ name: 'Kelly', percent: 10 }],
      shareholders: holders,
    });
    assert.equal(result.available, -5_000);
    assert.equal(result.direction, 'pay_in');
    assert.equal(result.bonusTotal, 0);
    assert.equal(result.bonus[0].amount, 0);
    assert.equal(result.staffReserve, 0);
    assert.equal(result.companyReserve, 0);
    assert.equal(result.shareholderPool, 0);
    assert.equal(result.shareholders[0].amount, 3_000);
    assert.equal(result.shareholders[1].amount, 2_000);
    assert.equal(
      result.shareholders[0].amount + result.shareholders[1].amount,
      -result.available,
    );
  });

  it('splits a surplus with no bonus into 5% staff and 30/70 of the rest', () => {
    const result = splitTakeOut({
      operatingCash: 10_000,
      pendingOut: 0,
      bonuses: [],
      shareholders: [{ name: 'William', sharePercent: 100 }],
    });
    assert.equal(result.available, 10_000);
    assert.equal(result.staffReserve, 500);
    assert.equal(result.companyReserve, 2_850);
    assert.equal(result.shareholderPool, 6_650);
    assert.equal(result.shareholders[0].amount, 6_650);
    assert.equal(result.staffReserve + result.companyReserve + result.shareholderPool, 10_000);
  });

  it('takes a 10% bonus before the reserves', () => {
    const result = splitTakeOut({
      operatingCash: 10_000,
      pendingOut: 0,
      bonuses: [{ name: 'Kelly', percent: 10 }],
      shareholders: [{ name: 'William', sharePercent: 100 }],
    });
    assert.equal(result.bonus[0].amount, 1_000);
    assert.equal(result.afterBonus, 9_000);
    assert.equal(result.staffReserve, 450);
    assert.equal(result.companyReserve, 2_565);
    assert.equal(result.shareholderPool, 5_985);
    assert.equal(
      result.bonusTotal + result.staffReserve + result.companyReserve + result.shareholderPool,
      10_000,
    );
  });

  it('shares the shareholder pool by ownership', () => {
    const result = splitTakeOut({
      operatingCash: 10_000,
      pendingOut: 0,
      bonuses: [],
      shareholders: holders,
    });
    assert.equal(result.shareholders[0].amount, 3_990);
    assert.equal(result.shareholders[1].amount, 2_660);
    assert.equal(result.shareholders[0].amount + result.shareholders[1].amount, result.shareholderPool);
  });

  it('uses the whole surplus for bonus shares that add up to more than 100%', () => {
    const result = splitTakeOut({
      operatingCash: 10_000,
      pendingOut: 0,
      bonuses: [
        { name: 'Kelly', percent: 80 },
        { name: 'Tristan', percent: 80 },
      ],
      shareholders: holders,
    });
    assert.equal(result.bonusExceedsCash, true);
    assert.equal(result.bonusTotal, 10_000);
    assert.equal(result.bonus[0].amount, 5_000);
    assert.equal(result.bonus[1].amount, 5_000);
    assert.equal(result.afterBonus, 0);
    assert.equal(result.staffReserve, 0);
    assert.equal(result.companyReserve, 0);
    assert.equal(result.shareholderPool, 0);
  });

  it('leaves the shareholder pool unassigned when every share is 0%', () => {
    const result = splitTakeOut({
      operatingCash: 10_000,
      pendingOut: 0,
      bonuses: [],
      shareholders: [{ name: 'William', sharePercent: 0 }],
    });
    assert.equal(result.shareholders[0].amount, 0);
    assert.equal(result.unassignedShareholderPool, result.shareholderPool);
    assert.equal(result.unassignedShareholderPool, 6_650);
  });
});
