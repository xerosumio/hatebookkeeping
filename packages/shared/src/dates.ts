/**
 * Business dates are calendar days in Hong Kong, kept as "YYYY-MM-DD" text.
 * A day stored this way cannot shift across a month boundary whatever clock
 * the server or the browser uses. Months are "YYYY-MM".
 */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const HK_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function toUtc(ymd: string): Date {
  const match = YMD.exec(ymd);
  if (!match) throw new Error(`Not a date: ${ymd}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function fromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isValidYmd(value: string): boolean {
  if (!YMD.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function isValidMonth(value: string): boolean {
  const match = MONTH.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** The calendar day in Hong Kong at the given instant. Hong Kong has no DST. */
export function hkDateOf(instant: Date): string {
  return fromUtc(new Date(instant.getTime() + HK_OFFSET_MS));
}

export function hkToday(now: Date = new Date()): string {
  return hkDateOf(now);
}

export function hkCurrentMonth(now: Date = new Date()): string {
  return monthOf(hkToday(now));
}

export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function addDays(ymd: string, days: number): string {
  return fromUtc(new Date(toUtc(ymd).getTime() + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

export function addMonthsToMonth(month: string, count: number): string {
  const match = MONTH.exec(month);
  if (!match) throw new Error(`Not a month: ${month}`);
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + count;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function lastDayOfMonth(month: string): string {
  return addDays(`${addMonthsToMonth(month, 1)}-01`, -1);
}

/** `from` is the first day; `to` is the first day of the next month (exclusive). */
export function monthBounds(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${addMonthsToMonth(month, 1)}-01` };
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);
}

/** The given day of the month, clamped to the month's length. */
export function dayInMonth(month: string, day: number): string {
  const last = Number(lastDayOfMonth(month).slice(8));
  return `${month}-${pad(Math.min(Math.max(day, 1), last))}`;
}

/** "24 Nov 2026" */
export function formatDate(ymd: string | null | undefined): string {
  if (!ymd || !YMD.test(ymd)) return '';
  const date = toUtc(ymd);
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]!.slice(0, 3)} ${date.getUTCFullYear()}`;
}

/** "November 2026" */
export function monthLabel(month: string): string {
  const match = MONTH.exec(month);
  if (!match) return month;
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}

/** "Nov" */
export function shortMonthLabel(month: string): string {
  const match = MONTH.exec(month);
  if (!match) return month;
  return MONTH_NAMES[Number(match[2]) - 1]!.slice(0, 3);
}

/** "24 Nov 2026, 14:05" in Hong Kong time, for activity logs. */
export function formatDateTime(instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return '';
  const hk = new Date(date.getTime() + HK_OFFSET_MS);
  return `${formatDate(fromUtc(hk))}, ${pad(hk.getUTCHours())}:${pad(hk.getUTCMinutes())}`;
}
