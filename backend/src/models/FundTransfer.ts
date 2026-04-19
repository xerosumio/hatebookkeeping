import mongoose, { Document, Schema } from 'mongoose';

export interface IFundTransfer extends Document {
  fromFund?: mongoose.Types.ObjectId;
  toFund?: mongoose.Types.ObjectId;
  amount: number;
  date: Date;
  description: string;
  reference?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const fundTransferSchema = new Schema<IFundTransfer>(
  {
    fromFund: { type: Schema.Types.ObjectId, ref: 'Fund' },
    toFund: { type: Schema.Types.ObjectId, ref: 'Fund' },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true, trim: true },
    reference: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

fundTransferSchema.index({ fromFund: 1, date: -1 });
fundTransferSchema.index({ toFund: 1, date: -1 });

export const FundTransfer = mongoose.model<IFundTransfer>('FundTransfer', fundTransferSchema);
