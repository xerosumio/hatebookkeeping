import { addDays, addMonthsToMonth, dayInMonth, monthOf } from './dates.js';

export const FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  monthly: 'Every month',
  quarterly: 'Every 3 months',
  yearly: 'Every year',
};

const STEP_MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, yearly: 12 };
const MAX_PERIODS = 600;

export interface RecurringSchedule {
  startDate: string;
  endDate: string | null;
  dayOfMonth: number;
  frequency: Frequency;
}

/**
 * Every due date of a schedule from its start up to and including `until`.
 * A due date doubles as the period's key: an item generates once per due date.
 */
export function duePeriods(schedule: RecurringSchedule, until: string): string[] {
  const step = STEP_MONTHS[schedule.frequency];
  let month = monthOf(schedule.startDate);
  if (dayInMonth(month, schedule.dayOfMonth) < schedule.startDate) {
    month = addMonthsToMonth(month, 1);
  }
  const periods: string[] = [];
  while (periods.length < MAX_PERIODS) {
    const due = dayInMonth(month, schedule.dayOfMonth);
    if (due > until) break;
    if (schedule.endDate && due > schedule.endDate) break;
    periods.push(due);
    month = addMonthsToMonth(month, step);
  }
  return periods;
}

export type RecurringState = 'paused' | 'ended' | 'overdue' | 'due' | 'upcoming';

export interface RecurringStatus {
  state: RecurringState;
  /** Due dates that are inside the reminder window or past, and not yet generated or skipped. */
  pending: string[];
  /** The next due date still to come, or null when the schedule has ended. */
  nextDue: string | null;
}

/**
 * An item stays due (then overdue) until its period is generated or skipped.
 * It never jumps to the next period on its own.
 */
export function recurringStatus(
  schedule: RecurringSchedule & { active: boolean; remindDaysBefore: number },
  handled: ReadonlySet<string>,
  today: string,
): RecurringStatus {
  const horizon = addDays(today, 400);
  const open = duePeriods(schedule, horizon).filter((period) => !handled.has(period));
  const windowEnd = addDays(today, schedule.remindDaysBefore);
  const pending = open.filter((period) => period <= windowEnd);
  const nextDue = open.find((period) => period > windowEnd) ?? null;

  if (!schedule.active) return { state: 'paused', pending: [], nextDue: null };
  if (pending.some((period) => period < today)) return { state: 'overdue', pending, nextDue };
  if (pending.length > 0) return { state: 'due', pending, nextDue };
  if (nextDue === null) return { state: 'ended', pending, nextDue };
  return { state: 'upcoming', pending, nextDue };
}
