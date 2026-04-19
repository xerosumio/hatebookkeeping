import mongoose, { Document, Schema } from 'mongoose';

export interface IDistributionEntry {
  shareholder: mongoose.Types.ObjectId;
  sharePercent: number;
  amount: number;
  equityTransaction?: mongoose.Types.ObjectId;
}

export interface IMonthlyClose extends Document {
  year: number;
  month: number;
  status: 'draft' | 'finalized';
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  shareholderDistribution: number;
  companyReserve: number;
  staffReserve: number;
  distributions: IDistributionEntry[];
  isLoss: boolean;
  closedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const distributionEntrySchema = new Schema<IDistributionEntry>(
  {
    shareholder: { type: Schema.Types.ObjectId, ref: 'Shareholder', required: true },
    sharePercent: { type: Number, required: true },
    amount: { type: Number, required: true },
    equityTransaction: { type: Schema.Types.ObjectId, ref: 'EquityTransaction' },
  },
  { _id: false },
);

const monthlyCloseSchema = new Schema<IMonthlyClose>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      enum: ['draft', 'finalized'],
      default: 'draft',
    },
    totalIncome: { type: Number, required: true },
    totalExpense: { type: Number, required: true },
    netProfit: { type: Number, required: true },
    shareholderDistribution: { type: Number, default: 0 },
    companyReserve: { type: Number, default: 0 },
    staffReserve: { type: Number, default: 0 },
    distributions: [distributionEntrySchema],
    isLoss: { type: Boolean, default: false },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

monthlyCloseSchema.index({ year: 1, month: 1 }, { unique: true });

export const MonthlyClose = mongoose.model<IMonthlyClose>('MonthlyClose', monthlyCloseSchema);
