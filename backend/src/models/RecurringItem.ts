import mongoose, { Document, Schema } from 'mongoose';

export interface IRecurringItem extends Document {
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  client?: mongoose.Types.ObjectId;
  description: string;
  startDate: Date;
  endDate?: Date;
  active: boolean;
  lastGeneratedDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const recurringItemSchema = new Schema<IRecurringItem>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    description: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    active: { type: Boolean, default: true },
    lastGeneratedDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

recurringItemSchema.index({ active: 1, frequency: 1 });

export const RecurringItem = mongoose.model<IRecurringItem>('RecurringItem', recurringItemSchema);
