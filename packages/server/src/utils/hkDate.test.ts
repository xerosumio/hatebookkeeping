import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatHkYmd,
  hkDayBounds,
  hkInclusiveRange,
  hkInstant,
  hkMonthBounds,
  hkYearBounds,
  parseYmd,
} from './hkDate.js';

describe('hkDate', () => {
  it('parses YYYY-MM-DD', () => {
    assert.deepEqual(parseYmd('2026-09-01'), { year: 2026, month: 9, day: 1 });
  });

  it('maps the 1st of a month to 16:00 UTC the previous day', () => {
    const d = hkInstant(2026, 9, 1);
    assert.equal(d.toISOString(), '2026-08-31T16:00:00.000Z');
    assert.equal(formatHkYmd(d), '2026-09-01');
  });

  it('uses exclusive end so the 1st is inside September and outside August', () => {
    const sep = hkMonthBounds(2026, 9);
    const first = hkInstant(2026, 9, 1);
    const oct1 = hkInstant(2026, 10, 1);
    assert.ok(first >= sep.from && first < sep.to);
    assert.ok(oct1.getTime() === sep.to.getTime());
    assert.ok(!(oct1 >= sep.from && oct1 < sep.to));

    const aug = hkMonthBounds(2026, 8);
    assert.ok(!(first >= aug.from && first < aug.to));
  });

  it('covers a full inclusive custom range including both endpoints', () => {
    const range = hkInclusiveRange('2026-09-01', '2026-09-07');
    assert.equal(range.from.toISOString(), '2026-08-31T16:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-09-07T16:00:00.000Z');
    const day1 = hkInstant(2026, 9, 1);
    const day7 = hkInstant(2026, 9, 7);
    assert.ok(day1 >= range.from && day1 < range.to);
    assert.ok(day7 >= range.from && day7 < range.to);
  });

  it('treats a single day as [midnight, next midnight)', () => {
    const day = hkDayBounds('2026-09-01');
    assert.equal(day.to.getTime() - day.from.getTime(), 24 * 60 * 60 * 1000);
  });

  it('spans a calendar year in Hong Kong', () => {
    const y = hkYearBounds(2026);
    assert.equal(y.from.toISOString(), '2025-12-31T16:00:00.000Z');
    assert.equal(y.to.toISOString(), '2026-12-31T16:00:00.000Z');
  });
});
