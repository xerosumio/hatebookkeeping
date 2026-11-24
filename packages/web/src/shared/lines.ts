import { centsToInput, computeTotals, type DiscountType, type LineItemDto } from '@hbk/shared';
import { centsOf, numberOf } from './form';

/** A line as it is typed: text boxes hold text, and are turned into numbers on save. */
export interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  waived: boolean;
}

export interface DiscountDraft {
  type: DiscountType;
  value: string;
}

export const emptyLine = (): LineDraft => ({ description: '', quantity: '1', unitPrice: '', waived: false });

export const linesFromDto = (lines: LineItemDto[]): LineDraft[] =>
  lines.map((line) => ({
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: centsToInput(line.unitPrice),
    waived: line.waived,
  }));

export const discountFromDto = (type: DiscountType, value: number): DiscountDraft => ({
  type,
  value: type === 'amount' ? centsToInput(value) : type === 'percent' ? String(value) : '',
});

export const linesPayload = (lines: LineDraft[]) =>
  lines.map((line) => ({
    description: line.description,
    quantity: numberOf(line.quantity),
    unitPrice: centsOf(line.unitPrice),
    waived: line.waived,
  }));

export const discountPayload = (discount: DiscountDraft) => ({
  discountType: discount.type,
  discountValue: discount.type === 'none' ? 0 : discount.type === 'amount' ? centsOf(discount.value) : numberOf(discount.value),
});

/** A preview of the totals. The server calculates the real ones with the same function. */
export function previewTotals(lines: LineDraft[], discount: DiscountDraft) {
  const clean = linesPayload(lines).map((line) => ({
    ...line,
    quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
  }));
  const { discountType, discountValue } = discountPayload(discount);
  return computeTotals(clean, discountType, Number.isFinite(discountValue) ? discountValue : 0);
}
