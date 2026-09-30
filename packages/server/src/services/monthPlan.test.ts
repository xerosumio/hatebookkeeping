import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hkInstant, hkMonthBounds, hkYearBounds } from '../utils/hkDate.js';
import { buildMonthPlan, PlanBoundsError, resolvePlanBounds, type MonthPlanSourceInvoice, type MonthPlanSourceRequest } from './monthPlan.js';

const { from, to } = hkMonthBounds(2026, 9);

function invoice(partial: Partial<MonthPlanSourceInvoice> & Pick<MonthPlanSourceInvoice, 'id' | 'status' | 'invoiceDate'>): MonthPlanSourceInvoice {
  return {
    invoiceNumber: partial.id,
    clientName: 'Client',
    total: 0,
    amountPaid: 0,
    amountDue: 0,
    ...partial,
  };
}

function request(partial: Partial<MonthPlanSourceRequest> & Pick<MonthPlanSourceRequest, 'id' | 'status' | 'createdAt'>): MonthPlanSourceRequest {
  return {
    requestNumber: partial.id,
    description: '',
    payeeNames: [],
    totalAmount: 0,
    ...partial,
  };
}

describe('resolvePlanBounds', () => {
  it('uses a calendar month when year and month are set', () => {
    const bounds = resolvePlanBounds({ year: 2026, month: 9 });
    assert.deepEqual(bounds, hkMonthBounds(2026, 9));
  });

  it('covers a calendar year through both endpoints', () => {
    const bounds = resolvePlanBounds({ startDate: '2026-01-01', endDate: '2026-12-31' });
    assert.deepEqual(bounds, hkYearBounds(2026));
    assert.equal(bounds.from.getTime(), hkInstant(2026, 1, 1).getTime());
    assert.ok(hkInstant(2026, 12, 31).getTime() >= bounds.from.getTime());
    assert.ok(hkInstant(2026, 12, 31).getTime() < bounds.to.getTime());
    assert.ok(hkInstant(2027, 1, 1).getTime() >= bounds.to.getTime());
  });

  it('includes both ends of a custom range', () => {
    const bounds = resolvePlanBounds({ startDate: '2026-09-10', endDate: '2026-09-12' });
    assert.equal(bounds.from.getTime(), hkInstant(2026, 9, 10).getTime());
    assert.ok(hkInstant(2026, 9, 12).getTime() < bounds.to.getTime());
    assert.ok(hkInstant(2026, 9, 13).getTime() >= bounds.to.getTime());
  });

  it('rejects a missing or reversed range', () => {
    assert.throws(() => resolvePlanBounds({ startDate: '2026-09-01' }), PlanBoundsError);
    assert.throws(() => resolvePlanBounds({ startDate: '2026-09-12', endDate: '2026-09-01' }), PlanBoundsError);
    assert.throws(() => resolvePlanBounds({ year: 2026, month: 13 }), PlanBoundsError);
  });
});

describe('buildMonthPlan', () => {
  const invoices: MonthPlanSourceInvoice[] = [
    invoice({
      id: 'partial',
      invoiceNumber: 'INV-2',
      invoiceDate: hkInstant(2026, 9, 5),
      status: 'partial',
      total: 10_000,
      amountPaid: 4_000,
      amountDue: 6_000,
    }),
    invoice({
      id: 'paid',
      invoiceNumber: 'INV-1',
      invoiceDate: hkInstant(2026, 9, 10),
      status: 'paid',
      total: 3_000,
      amountPaid: 3_000,
      amountDue: 0,
    }),
    invoice({
      id: 'older-open',
      invoiceDate: hkInstant(2026, 8, 15),
      status: 'unpaid',
      total: 2_000,
      amountDue: 2_000,
    }),
    invoice({
      id: 'older-paid',
      invoiceDate: hkInstant(2026, 8, 1),
      status: 'paid',
      total: 9_000,
      amountPaid: 9_000,
      amountDue: 0,
    }),
    invoice({
      id: 'draft',
      invoiceDate: hkInstant(2026, 9, 3),
      status: 'draft',
      total: 9_999,
      amountDue: 9_999,
    }),
    invoice({
      id: 'future',
      invoiceDate: hkInstant(2026, 10, 2),
      status: 'unpaid',
      total: 500,
      amountDue: 500,
    }),
    invoice({
      id: 'month-start',
      invoiceNumber: 'INV-0',
      invoiceDate: from,
      status: 'unpaid',
      total: 100,
      amountDue: 100,
    }),
    invoice({
      id: 'next-month-start',
      invoiceDate: to,
      status: 'unpaid',
      total: 50,
      amountDue: 50,
    }),
  ];

  const requests: MonthPlanSourceRequest[] = [
    request({
      id: 'executed',
      requestNumber: 'PR-2',
      createdAt: hkInstant(2026, 9, 2),
      status: 'executed',
      totalAmount: 5_000,
      description: 'Rent',
      payeeNames: ['Landlord'],
    }),
    request({
      id: 'open',
      requestNumber: 'PR-1',
      createdAt: hkInstant(2026, 9, 20),
      status: 'pending',
      totalAmount: 1_500,
    }),
    request({
      id: 'approved-month',
      createdAt: hkInstant(2026, 9, 12),
      status: 'approved',
      totalAmount: 200,
    }),
    request({
      id: 'older-open',
      createdAt: hkInstant(2026, 8, 20),
      status: 'approved',
      totalAmount: 800,
    }),
    request({
      id: 'older-executed',
      createdAt: hkInstant(2026, 8, 2),
      status: 'executed',
      totalAmount: 4_000,
    }),
    request({
      id: 'rejected',
      createdAt: hkInstant(2026, 9, 8),
      status: 'rejected',
      totalAmount: 7_000,
    }),
    request({
      id: 'future',
      createdAt: hkInstant(2026, 10, 3),
      status: 'pending',
      totalAmount: 60,
    }),
  ];

  const plan = buildMonthPlan(invoices, requests, { from, to });

  it('splits this month invoices into collected and still due, and drops drafts', () => {
    assert.deepEqual(plan.incoming.items.map((row) => row.id), ['month-start', 'partial', 'paid']);
    assert.equal(plan.incoming.billed, 13_100);
    assert.equal(plan.incoming.collected, 7_000);
    assert.equal(plan.incoming.pending, 6_100);
    assert.equal(plan.incoming.count, 3);
    assert.equal(plan.incoming.items.some((row) => row.id === 'draft'), false);
  });

  it('keeps older open invoices in carryover and drops paid or future ones', () => {
    assert.deepEqual(plan.carryover.receivable.items.map((row) => row.id), ['older-open']);
    assert.equal(plan.carryover.receivable.total, 2_000);
    assert.equal(plan.carryover.receivable.count, 1);
  });

  it('splits this month requests into paid and still to pay, and drops rejected ones', () => {
    assert.deepEqual(plan.outgoing.items.map((row) => row.id), ['executed', 'approved-month', 'open']);
    assert.equal(plan.outgoing.committed, 6_700);
    assert.equal(plan.outgoing.paid, 5_000);
    assert.equal(plan.outgoing.pending, 1_700);
    assert.equal(plan.outgoing.count, 3);
    assert.equal(plan.outgoing.items[0]?.payeeNames[0], 'Landlord');
  });

  it('keeps older open requests in carryover and drops executed ones', () => {
    assert.deepEqual(plan.carryover.payable.items.map((row) => row.id), ['older-open']);
    assert.equal(plan.carryover.payable.total, 800);
    assert.equal(plan.carryover.payable.count, 1);
  });

  it('plans pending in and out from this month plus carryover', () => {
    assert.equal(plan.plan.pendingIn, 8_100);
    assert.equal(plan.plan.pendingOut, 2_500);
    assert.equal(plan.plan.net, 5_600);
  });

  it('places payment requests by due date and falls back to created date', () => {
    const dated = buildMonthPlan([], [
      request({
        id: 'due-this-month',
        createdAt: hkInstant(2026, 8, 2),
        dueDate: hkInstant(2026, 9, 15),
        status: 'pending',
        totalAmount: 100,
      }),
      request({
        id: 'due-next-month',
        createdAt: hkInstant(2026, 9, 2),
        dueDate: hkInstant(2026, 10, 2),
        status: 'pending',
        totalAmount: 50,
      }),
      request({
        id: 'due-last-month',
        createdAt: hkInstant(2026, 9, 2),
        dueDate: hkInstant(2026, 8, 10),
        status: 'approved',
        totalAmount: 70,
      }),
    ], { from, to });

    assert.deepEqual(dated.outgoing.items.map((row) => row.id), ['due-this-month']);
    assert.equal(dated.outgoing.items[0]?.dueDate, hkInstant(2026, 9, 15).toISOString());
    assert.deepEqual(dated.carryover.payable.items.map((row) => row.id), ['due-last-month']);
  });

  it('builds profit and loss from invoice date and bill due date', () => {
    assert.equal(plan.pl.totals.income, plan.incoming.billed);
    assert.equal(plan.pl.totals.expense, plan.outgoing.committed);
    assert.equal(plan.pl.totals.net, 13_100 - 6_700);
    assert.deepEqual(plan.pl.income, [{ category: 'Revenue', total: 13_100, count: 3 }]);

    const dated = buildMonthPlan(
      [
        invoice({
          id: 'this-month',
          invoiceDate: hkInstant(2026, 9, 10),
          status: 'unpaid',
          total: 8_000,
          amountDue: 8_000,
        }),
        invoice({
          id: 'older-collected-now',
          invoiceDate: hkInstant(2026, 8, 1),
          status: 'paid',
          total: 9_000,
          amountPaid: 9_000,
          amountDue: 0,
        }),
      ],
      [
        request({
          id: 'due-this-month',
          createdAt: hkInstant(2026, 8, 2),
          dueDate: hkInstant(2026, 9, 15),
          status: 'pending',
          totalAmount: 1_500,
          items: [
            { category: 'Salary', amount: 1_000 },
            { category: 'Rent', amount: 500 },
          ],
        }),
        request({
          id: 'created-this-month-due-later',
          createdAt: hkInstant(2026, 9, 2),
          dueDate: hkInstant(2026, 10, 2),
          status: 'executed',
          totalAmount: 4_000,
          items: [{ category: 'Salary', amount: 4_000 }],
        }),
      ],
      { from, to },
    );

    assert.equal(dated.pl.totals.income, 8_000);
    assert.equal(dated.pl.totals.expense, 1_500);
    assert.equal(dated.pl.totals.net, 6_500);
    assert.deepEqual(dated.pl.expenses, [
      { category: 'Salary', total: 1_000, count: 1 },
      { category: 'Rent', total: 500, count: 1 },
    ]);
  });
});
