import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeBlockReason, planClose, reopenBlockReason } from './monthlyClose.js';
import { splitTakeOut } from './takeOut.js';

const holders = [
  { id: 'sh-w', name: 'William', payee: 'payee-w', userId: 'u-w' },
  { id: 'sh-a', name: 'Andy', payee: 'payee-a', userId: 'u-a' },
];
const bonusPeople = [{ id: 'bonus-k', name: 'Kit', payee: 'payee-k', userId: 'u-k' }];

function takeOutFor(operatingCash: number, pendingOut = 0, bonusPercent = 10) {
  return splitTakeOut({
    operatingCash,
    pendingOut,
    bonuses: [{ name: 'Kit', percent: bonusPercent }],
    shareholders: [
      { name: 'William', sharePercent: 60 },
      { name: 'Andy', sharePercent: 40 },
    ],
  });
}

describe('planClose', () => {
  it('posts reserves and one payout line per bonus user and shareholder', () => {
    const takeOut = takeOutFor(10_000);
    const plan = planClose(takeOut, bonusPeople, holders);

    assert.equal(plan.direction, 'take_out');
    assert.equal(plan.staffReserve, takeOut.staffReserve);
    assert.equal(plan.companyReserve, takeOut.companyReserve);
    assert.deepEqual(plan.payouts.map((line) => [line.kind, line.personId, line.payee, line.amount]), [
      ['bonus', 'bonus-k', 'payee-k', 1_000],
      ['shareholder', 'sh-w', 'payee-w', takeOut.shareholders[0].amount],
      ['shareholder', 'sh-a', 'payee-a', takeOut.shareholders[1].amount],
    ]);
    assert.deepEqual(plan.missingPayees, []);

    const posted = plan.staffReserve + plan.companyReserve + plan.payouts.reduce((sum, line) => sum + line.amount, 0);
    assert.equal(posted, takeOut.available);
  });

  it('skips zero-amount lines', () => {
    const plan = planClose(takeOutFor(10_000, 0, 0), bonusPeople, holders);
    assert.deepEqual(plan.payouts.map((line) => line.kind), ['shareholder', 'shareholder']);
  });

  it('posts nothing when there is a shortfall', () => {
    const plan = planClose(takeOutFor(1_000, 5_000), bonusPeople, holders);
    assert.equal(plan.direction, 'pay_in');
    assert.equal(plan.staffReserve, 0);
    assert.equal(plan.companyReserve, 0);
    assert.deepEqual(plan.payouts, []);
  });

  it('lists people who are owed money but have no payee', () => {
    const plan = planClose(
      takeOutFor(10_000),
      [{ ...bonusPeople[0], payee: null }],
      [holders[0], { ...holders[1], payee: null }],
    );
    assert.deepEqual(plan.missingPayees, [
      { kind: 'bonus', name: 'Kit' },
      { kind: 'shareholder', name: 'Andy' },
    ]);
  });
});

describe('closeBlockReason', () => {
  const now = new Date('2026-10-29T04:00:00Z');

  it('allows closing an open month', () => {
    assert.equal(closeBlockReason({ alreadyClosed: false, missingPayees: [], year: 2026, month: 10, now }), null);
  });

  it('rejects a second close of the same month', () => {
    assert.match(
      closeBlockReason({ alreadyClosed: true, missingPayees: [], year: 2026, month: 10, now }) ?? '',
      /already closed/,
    );
  });

  it('rejects a month that has not started', () => {
    assert.match(
      closeBlockReason({ alreadyClosed: false, missingPayees: [], year: 2026, month: 11, now }) ?? '',
      /not started/,
    );
  });

  it('rejects when a payee is missing', () => {
    const reason = closeBlockReason({
      alreadyClosed: false,
      missingPayees: [{ kind: 'shareholder', name: 'Andy' }],
      year: 2026,
      month: 10,
      now,
    });
    assert.match(reason ?? '', /Andy/);
  });
});

describe('reopenBlockReason', () => {
  it('allows reopening when the payout request is pending, rejected, or gone', () => {
    assert.equal(reopenBlockReason('pending'), null);
    assert.equal(reopenBlockReason('rejected'), null);
    assert.equal(reopenBlockReason(null), null);
  });

  it('blocks reopening once the payout request is approved or executed', () => {
    assert.match(reopenBlockReason('approved') ?? '', /approved/);
    assert.match(reopenBlockReason('executed') ?? '', /executed/);
  });
});
