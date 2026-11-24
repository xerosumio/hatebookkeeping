import { Schema } from 'mongoose';
import type { ComputedLineItem, LineItemDto } from '@hbk/shared';

/** A priced line on a quote or invoice. `amount` is always computed by the server. */
export const lineItemSchema = new Schema<ComputedLineItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    waived: { type: Boolean, default: false },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

export const lineItemDto = (line: ComputedLineItem): LineItemDto => ({
  description: line.description,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  waived: line.waived,
  amount: line.amount,
});
