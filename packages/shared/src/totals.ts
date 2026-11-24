export const DISCOUNT_TYPES = ['none', 'amount', 'percent'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface LineItemValues {
  description: string;
  quantity: number;
  /** Whole cents. */
  unitPrice: number;
  waived?: boolean;
}

export interface ComputedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  waived: boolean;
  amount: number;
}

export interface ComputedTotals {
  lineItems: ComputedLineItem[];
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * The only place document totals are calculated. The server runs this on
 * every save and ignores any totals the browser sends; the web app runs the
 * same function to preview them.
 */
export function computeTotals(
  items: readonly LineItemValues[],
  discountType: DiscountType,
  discountValue: number,
): ComputedTotals {
  const lineItems = items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    waived: item.waived === true,
    amount: item.waived === true ? 0 : Math.round(item.quantity * item.unitPrice),
  }));
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  let discount = 0;
  if (discountType === 'percent') discount = Math.round((subtotal * discountValue) / 100);
  if (discountType === 'amount') discount = Math.round(discountValue);
  return { lineItems, subtotal, discount, total: subtotal - discount };
}

/**
 * Splits a total across milestones by percentage. The last milestone takes
 * whatever rounding leaves over, so the parts always add up to the total.
 */
export function milestoneAmounts(total: number, percentages: readonly number[]): number[] {
  let allocated = 0;
  return percentages.map((percentage, index) => {
    if (index === percentages.length - 1) return total - allocated;
    const amount = Math.round((total * percentage) / 100);
    allocated += amount;
    return amount;
  });
}
