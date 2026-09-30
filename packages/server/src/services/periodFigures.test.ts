import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCashMovement,
  isPlCategory,
  openingFromOperatingAndForwardCash,
  PL_EXCLUDED_CATEGORIES,
} from './periodFigures.js';

describe('periodFigures rules', () => {
  it('excludes Currency Conversion from P&L and keeps Intercompany Transfer', () => {
    assert.equal(isPlCategory('Currency Conversion'), false);
    assert.equal(isPlCategory('Intercompany Transfer'), true);
    assert.equal(isPlCategory('Revenue'), true);
    assert.deepEqual([...PL_EXCLUDED_CATEGORIES], ['Currency Conversion']);
  });

  it('treats empty bankAccount expenses as non-cash', () => {
    assert.equal(isCashMovement({ type: 'income', bankAccount: '' }), true);
    assert.equal(isCashMovement({ type: 'expense', bankAccount: 'HSBC' }), true);
    assert.equal(isCashMovement({ type: 'expense', bankAccount: '' }), false);
    assert.equal(isCashMovement({ type: 'expense', bankAccount: null }), false);
  });

  it('does not let a non-cash expense inflate first-month opening cash', () => {
    const operatingNow = 100_000;
    const cashIn = 10_000;
    const cashOut = 4_000;
    const nonCashExpense = 50_000;
    const opening = openingFromOperatingAndForwardCash(operatingNow, cashIn, cashOut);
    assert.equal(opening, 94_000);
    const naiveAllTxnOpening = operatingNow - (cashIn - (cashOut + nonCashExpense));
    assert.notEqual(opening, naiveAllTxnOpening);
  });
});
