import mongoose, { Document, Schema } from 'mongoose';

export interface IShareLiability extends Document {
  shareholder: mongoose.Types.ObjectId;
  type: 'purchase' | 'payment';
  amount: number;
  date: Date;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const shareLiabilitySchema = new Schema<IShareLiability>(
  {
    shareholder: { type: Schema.Types.ObjectId, ref: 'Shareholder', required: true },
    type: { type: String, enum: ['purchase', 'payment'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

shareLiabilitySchema.index({ shareholder: 1, date: -1 });

export const ShareLiability = mongoose.model<IShareLiability>('ShareLiability', shareLiabilitySchema);
