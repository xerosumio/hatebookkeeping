import mongoose, { Document, Schema } from 'mongoose';

export interface IEquityTransaction extends Document {
  type: 'investment' | 'distribution' | 'collection' | 'adjustment' | 'liability_offset';
  shareholder: mongoose.Types.ObjectId;
  amount: number;
  date: Date;
  description: string;
  monthlyClose?: mongoose.Types.ObjectId;
  balanceAfter: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const equityTransactionSchema = new Schema<IEquityTransaction>(
  {
    type: {
      type: String,
      enum: ['investment', 'distribution', 'collection', 'adjustment', 'liability_offset'],
      required: true,
    },
    shareholder: { type: Schema.Types.ObjectId, ref: 'Shareholder', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true },
    monthlyClose: { type: Schema.Types.ObjectId, ref: 'MonthlyClose' },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

equityTransactionSchema.index({ shareholder: 1, date: -1 });
equityTransactionSchema.index({ monthlyClose: 1 });

export const EquityTransaction = mongoose.model<IEquityTransaction>('EquityTransaction', equityTransactionSchema);
