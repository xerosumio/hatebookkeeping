export function formatMoney(cents: number): string {
  return `HK$ ${(cents / 100).toLocaleString('en-HK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
