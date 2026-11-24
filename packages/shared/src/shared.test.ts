import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  addMonthsToMonth,
  computeTotals,
  dayInMonth,
  duePeriods,
  formatDate,
  formatMoney,
  hkToday,
  invoiceInputSchema,
  isValidYmd,
  lastDayOfMonth,
  milestoneAmounts,
  monthBounds,
  parseMoney,
  quoteInputSchema,
  recurringInputSchema,
  recurringStatus,
  validate,
  can,
} from './index.js';

const ID = 'a'.repeat(24);

describe('money', () => {
  it('reads typed amounts as whole cents without floating point drift', () => {
    assert.equal(parseMoney('19.99'), 1999);
    assert.equal(parseMoney('1,234.5'), 123450);
    assert.equal(parseMoney('HK$ 520'), 52000);
    assert.equal(parseMoney('.5'), 50);
    assert.equal(parseMoney('0.1'), 10);
  });

  it('rejects text that is not an amount', () => {
    assert.equal(parseMoney(''), null);
    assert.equal(parseMoney('abc'), null);
    assert.equal(parseMoney('1.234'), null);
    assert.equal(parseMoney('1.2.3'), null);
  });

  it('formats cents as Hong Kong dollars', () => {
    assert.equal(formatMoney(52000), 'HK$ 520.00');
    assert.equal(formatMoney(-123456), '-HK$ 1,234.56');
  });
});

describe('dates', () => {
  it('takes today from Hong Kong, not from UTC', () => {
    // 30 Nov 2026 17:00 UTC is already 1 Dec 01:00 in Hong Kong.
    assert.equal(hkToday(new Date('2026-11-30T17:00:00Z')), '2026-12-01');
    assert.equal(hkToday(new Date('2026-11-30T15:59:59Z')), '2026-11-30');
  });

  it('validates real calendar days only', () => {
    assert.equal(isValidYmd('2026-02-28'), true);
    assert.equal(isValidYmd('2026-02-30'), false);
    assert.equal(isValidYmd('2026-2-3'), false);
  });

  it('does month arithmetic across year ends', () => {
    assert.equal(addMonthsToMonth('2026-11', 2), '2027-01');
    assert.equal(addMonthsToMonth('2026-01', -1), '2025-12');
    assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
    assert.deepEqual(monthBounds('2026-12'), { from: '2026-12-01', to: '2027-01-01' });
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(dayInMonth('2026-02', 31), '2026-02-28');
    assert.equal(formatDate('2026-11-24'), '24 Nov 2026');
  });
});

describe('totals', () => {
  it('calculates line amounts, discount and total', () => {
    const totals = computeTotals(
      [
        { description: 'Design', quantity: 1.5, unitPrice: 100_000 },
        { description: 'Setup', quantity: 1, unitPrice: 50_000, waived: true },
      ],
      'percent',
      10,
    );
    assert.equal(totals.subtotal, 150_000);
    assert.equal(totals.discount, 15_000);
    assert.equal(totals.total, 135_000);
    assert.equal(totals.lineItems[1]!.amount, 0);
  });

  it('splits milestones so the parts always add up to the total', () => {
    const parts = milestoneAmounts(100_001, [33.33, 33.33, 33.34]);
    assert.equal(parts.reduce((sum, part) => sum + part, 0), 100_001);
  });
});

describe('recurring schedule', () => {
  const schedule = {
    startDate: '2026-01-20',
    endDate: null,
    dayOfMonth: 15,
    frequency: 'monthly' as const,
    active: true,
    remindDaysBefore: 7,
  };

  it('starts on the first due day on or after the start date', () => {
    assert.deepEqual(duePeriods(schedule, '2026-04-15'), ['2026-02-15', '2026-03-15', '2026-04-15']);
    assert.deepEqual(duePeriods({ ...schedule, frequency: 'quarterly' }, '2026-12-31'), [
      '2026-02-15',
      '2026-05-15',
      '2026-08-15',
      '2026-11-15',
    ]);
  });

  it('stays due on the due day instead of jumping to the next period', () => {
    const status = recurringStatus(schedule, new Set(), '2026-02-15');
    assert.equal(status.state, 'due');
    assert.deepEqual(status.pending, ['2026-02-15']);
    assert.equal(status.nextDue, '2026-03-15');
  });

  it('becomes overdue after the due day until it is generated', () => {
    assert.equal(recurringStatus(schedule, new Set(), '2026-02-20').state, 'overdue');
    const handled = recurringStatus(schedule, new Set(['2026-02-15']), '2026-02-20');
    assert.equal(handled.state, 'upcoming');
    assert.equal(handled.nextDue, '2026-03-15');
  });

  it('reports ended schedules and paused items', () => {
    const ended = { ...schedule, endDate: '2026-02-28' };
    assert.equal(recurringStatus(ended, new Set(['2026-02-15']), '2026-03-01').state, 'ended');
    assert.equal(recurringStatus({ ...schedule, active: false }, new Set(), '2026-02-20').state, 'paused');
  });
});

describe('schemas', () => {
  const quote = {
    companyId: ID,
    clientId: ID,
    title: 'Website',
    issueDate: '2026-11-24',
    lineItems: [{ description: 'Build', quantity: 1, unitPrice: 100_000 }],
  };

  it('accepts null and missing optional fields', () => {
    const result = validate(quoteInputSchema, { ...quote, validUntil: null, notes: null, terms: undefined });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.notes, '');
      assert.equal(result.value.validUntil, null);
      assert.deepEqual(result.value.paymentSchedule, []);
    }
  });

  it('names the field and says what is wrong', () => {
    const result = validate(quoteInputSchema, { ...quote, clientId: '', lineItems: [{ description: '', quantity: 0, unitPrice: -1 }] });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.fields.clientId, 'Choose a client');
      assert.equal(result.fields['lineItems.0.description'], 'Enter a description');
      assert.equal(result.fields['lineItems.0.quantity'], 'Quantity must be above zero');
      assert.equal(result.fields['lineItems.0.unitPrice'], 'A unit price cannot be negative');
    }
  });

  it('requires milestones to add up to 100%', () => {
    const result = validate(quoteInputSchema, {
      ...quote,
      paymentSchedule: [
        { label: 'Deposit', percentage: 50 },
        { label: 'Delivery', percentage: 40 },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.fields.paymentSchedule!, /add up to 90%/);
  });

  it('refuses a discount larger than the subtotal and a zero invoice', () => {
    const tooMuch = validate(quoteInputSchema, { ...quote, discountType: 'amount', discountValue: 200_000 });
    assert.equal(tooMuch.ok, false);
    const zero = validate(invoiceInputSchema, {
      ...quote,
      lineItems: [{ description: 'Free', quantity: 1, unitPrice: 0 }],
    });
    assert.equal(zero.ok, false);
    if (!zero.ok) assert.equal(zero.fields.lineItems, 'The total must be above zero');
  });

  it('requires a payee and category for a recurring expense, and a client for a recurring invoice', () => {
    const base = {
      name: 'Rent',
      companyId: ID,
      amount: 1_000_000,
      frequency: 'monthly',
      startDate: '2026-01-01',
      dayOfMonth: 1,
    };
    const expense = validate(recurringInputSchema, { ...base, kind: 'expense' });
    assert.equal(expense.ok, false);
    if (!expense.ok) {
      assert.equal(expense.fields.payeeId, 'Choose a payee');
      assert.equal(expense.fields.categoryId, 'Choose a category');
    }
    const invoice = validate(recurringInputSchema, { ...base, kind: 'invoice' });
    assert.equal(invoice.ok, false);
    if (!invoice.ok) assert.equal(invoice.fields.clientId, 'Choose a client');
    const missingStart = validate(recurringInputSchema, { ...base, kind: 'invoice', clientId: ID, startDate: '' });
    assert.equal(missingStart.ok, false);
  });
});

describe('permissions', () => {
  it('limits staff to their own claims', () => {
    assert.equal(can('staff', 'claims.own'), true);
    assert.equal(can('staff', 'claims.viewAll'), false);
    assert.equal(can('staff', 'pnl.view'), false);
    assert.equal(can('bookkeeper', 'settings.manage'), false);
    assert.equal(can('admin', 'settings.manage'), true);
    assert.equal(can(null, 'claims.own'), false);
  });
});
