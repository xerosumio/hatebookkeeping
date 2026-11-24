/** All amounts are whole Hong Kong cents. HK$520.00 is 52000. */

export const MAX_CENTS = 100_000_000_000;

export function formatMoney(cents: number): string {
  const abs = (Math.abs(cents) / 100).toLocaleString('en-HK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-HK$ ${abs}` : `HK$ ${abs}`;
}

/** Text for a money input box: "1234.50". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Reads what a person typed into a money box. Returns whole cents, or null
 * when the text is not an amount. Works on the digits directly so 19.99 never
 * becomes 1998 through floating point.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '').replace(/^HK\$/i, '');
  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents)) return null;
  return sign === '-' ? -cents : cents;
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
