/** Hong Kong has no DST; civil days are always UTC+8. */

const HK_OFFSET = '+08:00';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new Error(`Invalid date: ${ymd}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`Invalid date: ${ymd}`);
  return { year, month, day };
}

/** Instant at 00:00:00 in Asia/Hong_Kong. `month` is 1–12. */
export function hkInstant(year: number, month: number, day: number): Date {
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00${HK_OFFSET}`);
}

export function formatHkYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hkTodayYmd(now = new Date()): string {
  return formatHkYmd(now);
}

/** `[from, to)` covering a single HK calendar day. */
export function hkDayBounds(ymd: string): { from: Date; to: Date } {
  const { year, month, day } = parseYmd(ymd);
  const from = hkInstant(year, month, day);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Inclusive start/end calendar days as `[from, to)`. */
export function hkInclusiveRange(startYmd: string, endYmd: string): { from: Date; to: Date } {
  return { from: hkDayBounds(startYmd).from, to: hkDayBounds(endYmd).to };
}

/** `[from, to)` for a calendar month. `month` is 1–12. */
export function hkMonthBounds(year: number, month: number): { from: Date; to: Date } {
  const from = hkInstant(year, month, 1);
  const to = month === 12 ? hkInstant(year + 1, 1, 1) : hkInstant(year, month + 1, 1);
  return { from, to };
}

export function hkYearBounds(year: number): { from: Date; to: Date } {
  return { from: hkInstant(year, 1, 1), to: hkInstant(year + 1, 1, 1) };
}

/** All-time window: 2000-01-01 HK through end of today HK. */
export function hkAllTimeBounds(now = new Date()): { from: Date; to: Date } {
  return { from: hkInstant(2000, 1, 1), to: hkDayBounds(formatHkYmd(now)).to };
}
