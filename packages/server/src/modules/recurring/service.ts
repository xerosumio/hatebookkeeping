import { Types } from 'mongoose';
import {
  addDays,
  can,
  duePeriods,
  formatDate,
  formatMoney,
  hkToday,
  monthOf,
  recurringStatus,
  type DashboardDto,
  type GenerateResultDto,
  type RecurringDto,
  type RecurringStatus,
  ROLES,
  type Role,
} from '@hbk/shared';
import { emailHtml, sendEmail, type EmailResult } from '../../integrations/email.js';
import { record } from '../../platform/activity.js';
import { AppError, conflict } from '../../platform/errors.js';
import { countLabel, namesOf, refOf, registerReference } from '../../platform/references.js';
import { Client } from '../clients/model.js';
import { clientForInput } from '../clients/routes.js';
import { Company } from '../companies/model.js';
import { companyForInput, nextInternalNumber } from '../companies/service.js';
import { Expense } from '../expenses/model.js';
import { Invoice } from '../invoices/model.js';
import { createDraftInvoice } from '../invoices/service.js';
import { Payee, payeeForInput } from '../payees/routes.js';
import { assertCategories, categoryName, loadCategories } from '../settings/service.js';
import { User, type UserDoc } from '../users/model.js';
import { RecurringItem, RecurringRun, type RecurringDoc, type RecurringRunDoc } from './model.js';

registerReference('client', async (id) => countLabel(await RecurringItem.countDocuments({ clientId: id }), 'recurring item'));
registerReference('payee', async (id) => countLabel(await RecurringItem.countDocuments({ payeeId: id }), 'recurring item'));

// ── Where each item stands ──────────────────────────────────────────────────

async function runsByItem(itemIds: unknown[]): Promise<Map<string, RecurringRunDoc[]>> {
  const runs = await RecurringRun.find({ itemId: { $in: itemIds } }).sort({ period: -1 });
  const grouped = new Map<string, RecurringRunDoc[]>();
  for (const run of runs) {
    const key = String(run.itemId);
    grouped.set(key, [...(grouped.get(key) ?? []), run]);
  }
  return grouped;
}

/** An item stays due, then overdue, until its period is generated or skipped. */
export function statusOf(item: RecurringDoc, runs: readonly RecurringRunDoc[], today: string): RecurringStatus {
  const months = new Set(runs.map((run) => run.month));
  const handled = new Set(duePeriods(item, addDays(today, 400)).filter((period) => months.has(monthOf(period))));
  return recurringStatus(item, handled, today);
}

export async function recurringDtos(items: RecurringDoc[], today = hkToday()): Promise<RecurringDto[]> {
  const [runs, companies, clients, payees, categories] = await Promise.all([
    runsByItem(items.map((item) => item._id)),
    namesOf(Company, items.map((item) => item.companyId)),
    namesOf(Client, items.map((item) => item.clientId)),
    namesOf(Payee, items.map((item) => item.payeeId)),
    loadCategories(),
  ]);

  // The current number of each generated document (a draft invoice has none yet).
  const documentIds = [...runs.values()].flat().flatMap((run) => (run.documentId ? [run.documentId] : []));
  const [invoices, expenses] = await Promise.all([
    Invoice.find({ _id: { $in: documentIds } }).select('number').lean(),
    Expense.find({ _id: { $in: documentIds } }).select('number').lean(),
  ]);
  const numbers = new Map([...invoices, ...expenses].map((doc) => [String(doc._id), doc.number]));

  return items.map((item) => {
    const itemRuns = runs.get(String(item._id)) ?? [];
    const status = statusOf(item, itemRuns, today);
    const lastReminder = item.reminders[item.reminders.length - 1];
    return {
      id: String(item._id),
      kind: item.kind,
      name: item.name,
      company: refOf(companies, item.companyId),
      client: item.clientId ? refOf(clients, item.clientId, 'Removed client') : null,
      payee: item.payeeId ? refOf(payees, item.payeeId, 'Removed payee') : null,
      categoryId: item.categoryId ? String(item.categoryId) : null,
      categoryName: item.categoryId ? categoryName(categories, item.categoryId) : '',
      description: item.description,
      amount: item.amount,
      frequency: item.frequency,
      startDate: item.startDate,
      endDate: item.endDate,
      dayOfMonth: item.dayOfMonth,
      remindDaysBefore: item.remindDaysBefore,
      paymentTermsDays: item.paymentTermsDays,
      active: item.active,
      state: status.state,
      pending: status.pending,
      nextDue: status.nextDue,
      history: itemRuns.slice(0, 12).map((run) => ({
        period: run.period,
        action: run.action,
        at: run.createdAt.toISOString(),
        userName: run.userName,
        // A generated draft that was later deleted has no document any more.
        document: run.documentId && numbers.has(String(run.documentId)) ? { kind: item.kind, id: String(run.documentId), number: numbers.get(String(run.documentId)) ?? '' } : null,
      })),
      lastReminder: lastReminder ? { period: lastReminder.period, at: lastReminder.at.toISOString(), status: lastReminder.status, detail: lastReminder.detail } : null,
    };
  });
}

/** For the dashboard: items with a period waiting to be generated or skipped. */
export async function recurringDue(companyId: string | null, today: string): Promise<DashboardDto['recurringDue']> {
  const items = await RecurringItem.find({ active: true, ...(companyId ? { companyId: new Types.ObjectId(companyId) } : {}) }).sort({ name: 1 });
  const runs = await runsByItem(items.map((item) => item._id));
  return items.flatMap((item) => {
    const status = statusOf(item, runs.get(String(item._id)) ?? [], today);
    return status.pending.length > 0 ? [{ id: String(item._id), name: item.name, state: status.state, period: status.pending[0] }] : [];
  });
}

// ── Generating and skipping ─────────────────────────────────────────────────

/**
 * Marks a period as dealt with. The unique index on (item, month) decides the
 * winner when two requests arrive together; the loser is told it was done.
 */
async function claim(item: RecurringDoc, period: string, action: 'generated' | 'skipped', user: UserDoc, today: string): Promise<RecurringRunDoc> {
  if (!item.active) throw conflict(`“${item.name}” is paused. Resume it first.`);
  const runs = await RecurringRun.find({ itemId: item._id });
  const status = statusOf(item, runs, today);
  if (!status.pending.includes(period)) {
    if (runs.some((run) => run.month === monthOf(period))) throw conflict(`${formatDate(period)} has already been generated or skipped.`);
    throw conflict(`${formatDate(period)} is not due yet for “${item.name}”.`);
  }
  try {
    return await RecurringRun.create({ itemId: item._id, month: monthOf(period), period, action, userId: user._id, userName: user.name });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict(`${formatDate(period)} has already been generated or skipped.`);
    throw err;
  }
}

export async function skipPeriod(item: RecurringDoc, period: string, user: UserDoc, today = hkToday()): Promise<void> {
  await claim(item, period, 'skipped', user, today);
}

/** Checks that what the item points at can still be used, so a draft is never made for an archived client or payee. */
async function assertUsable(item: RecurringDoc): Promise<void> {
  await companyForInput(String(item.companyId));
  if (item.kind === 'invoice') {
    await clientForInput(String(item.clientId));
  } else {
    await payeeForInput(String(item.payeeId));
    assertCategories(await loadCategories(), 'expense', [String(item.categoryId)], () => 'categoryId');
  }
}

export interface Generated {
  kind: RecurringDoc['kind'];
  id: string;
  number: string;
}

/** Creates the draft invoice or expense for one period. It is a draft: a person still issues or submits it. */
export async function generatePeriod(item: RecurringDoc, period: string, user: UserDoc, today = hkToday()): Promise<Generated> {
  await assertUsable(item);
  const run = await claim(item, period, 'generated', user, today);
  const slot = `${String(item._id)}:${run.month}`;
  const note = `From the recurring item “${item.name}” for ${formatDate(period)}`;
  const description = item.description || item.name;

  try {
    let generated: Generated;
    if (item.kind === 'invoice') {
      const invoice = await createDraftInvoice(
        {
          companyId: item.companyId,
          clientId: item.clientId as Types.ObjectId,
          title: item.name,
          issueDate: period,
          dueDate: addDays(period, item.paymentTermsDays),
          lineItems: [{ description, quantity: 1, unitPrice: item.amount }],
          discountType: 'none',
          discountValue: 0,
          notes: '',
          bankDetails: null,
        },
        user,
        note,
        { recurringSlot: slot },
      );
      generated = { kind: 'invoice', id: String(invoice._id), number: invoice.number };
    } else {
      const expense = new Expense({
        kind: 'expense',
        number: await nextInternalNumber('expense'),
        companyId: item.companyId,
        title: item.name,
        payeeId: item.payeeId,
        expenseDate: period,
        dueDate: period,
        items: [{ description, categoryId: item.categoryId, amount: item.amount, date: period, receiptFileId: null, staffId: null, note: '' }],
        total: item.amount,
        authorIds: [user._id],
        recurringSlot: slot,
        createdById: user._id,
        createdByName: user.name,
      });
      record(expense, user, 'Created', note);
      await expense.save();
      generated = { kind: 'expense', id: String(expense._id), number: expense.number };
    }
    await RecurringRun.updateOne({ _id: run._id }, { $set: { documentId: new Types.ObjectId(generated.id) } });
    return generated;
  } catch (err) {
    // Nothing was created, so the period must not stay marked as done.
    await RecurringRun.deleteOne({ _id: run._id });
    throw err;
  }
}

/** Generates every period that is due. Each is attempted on its own: one that fails is reported and the rest carry on. */
export async function generateDue(user: UserDoc, companyId: string | null, today = hkToday()): Promise<GenerateResultDto[]> {
  const items = await RecurringItem.find({ active: true, ...(companyId ? { companyId: new Types.ObjectId(companyId) } : {}) }).sort({ name: 1 });
  const runs = await runsByItem(items.map((item) => item._id));
  const results: GenerateResultDto[] = [];
  for (const item of items) {
    for (const period of statusOf(item, runs.get(String(item._id)) ?? [], today).pending) {
      const base = { itemId: String(item._id), name: item.name, period };
      try {
        const document = await generatePeriod(item, period, user, today);
        results.push({ ...base, ok: true, message: `Draft ${document.kind} created`, document });
      } catch (err) {
        if (!(err instanceof AppError)) console.error(`[recurring] generating “${item.name}” for ${period} failed`, err);
        results.push({ ...base, ok: false, message: err instanceof AppError ? err.message : 'Something went wrong. Try this one again.', document: null });
      }
    }
  }
  return results;
}

// ── Reminders ───────────────────────────────────────────────────────────────

const OFFICE_ROLES = ROLES.filter((role: Role) => can(role, 'recurring.manage'));
const MAX_REMINDERS_KEPT = 24;

export interface ReminderRun {
  /** How many item-periods the email was about; 0 when there was nothing to say. */
  count: number;
  result: EmailResult | null;
}

/**
 * Emails the office once when a period comes into its reminder window, and
 * once more if its due date passes with nothing done. What happened to the
 * email is recorded on each item, so a failure is visible and is retried the
 * next day.
 */
export async function sendRecurringReminders(today = hkToday()): Promise<ReminderRun> {
  const items = await RecurringItem.find({ active: true }).sort({ name: 1 });
  const runs = await runsByItem(items.map((item) => item._id));

  const due: { item: RecurringDoc; period: string; overdue: boolean }[] = [];
  for (const item of items) {
    for (const period of statusOf(item, runs.get(String(item._id)) ?? [], today).pending) {
      const overdue = period < today;
      const told = item.reminders.some((reminder) => reminder.period === period && reminder.status === 'sent' && (reminder.overdue || !overdue));
      if (!told) due.push({ item, period, overdue });
    }
  }
  if (due.length === 0) return { count: 0, result: null };

  const [clients, payees, office] = await Promise.all([
    namesOf(Client, due.map(({ item }) => item.clientId)),
    namesOf(Payee, due.map(({ item }) => item.payeeId)),
    User.find({ active: true, role: { $in: OFFICE_ROLES } }).select('email'),
  ]);
  const overdueCount = due.filter((entry) => entry.overdue).length;
  const subject = `${due.length} recurring item${due.length === 1 ? ' is' : 's are'} due${overdueCount > 0 ? ` (${overdueCount} overdue)` : ''}`;
  const result = await sendEmail({
    to: office.map((user) => user.email),
    subject,
    html: emailHtml({
      heading: subject,
      intro: 'Open the recurring page to create each draft, or skip the period if it does not apply this time.',
      rows: due.map(({ item, period, overdue }) => [
        item.name,
        `${item.kind === 'invoice' ? `Invoice to ${clients.get(String(item.clientId)) ?? 'a removed client'}` : `Bill from ${payees.get(String(item.payeeId)) ?? 'a removed payee'}`} · ` +
          `${formatMoney(item.amount)} · ${overdue ? 'was due' : 'due'} ${formatDate(period)}`,
      ]),
      link: { label: 'Open recurring items', path: '/recurring' },
    }),
  });

  const at = new Date();
  for (const item of new Set(due.map((entry) => entry.item))) {
    const mine = due.filter((entry) => entry.item === item);
    await RecurringItem.updateOne({ _id: item._id }, { $pull: { reminders: { period: { $in: mine.map((entry) => entry.period) } } } });
    await RecurringItem.updateOne(
      { _id: item._id },
      {
        $push: {
          reminders: {
            $each: mine.map((entry) => ({ period: entry.period, overdue: entry.overdue, at, status: result.status, detail: result.detail })),
            $slice: -MAX_REMINDERS_KEPT,
          },
        },
      },
    );
  }
  return { count: due.length, result };
}
