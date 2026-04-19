import mongoose, { Document, Schema } from 'mongoose';

export interface IFund extends Document {
  name: string;
  type: 'reserve' | 'bank' | 'petty_cash';
  entity?: mongoose.Types.ObjectId;
  heldIn?: mongoose.Types.ObjectId;
  balance: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fundSchema = new Schema<IFund>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['reserve', 'bank', 'petty_cash'], required: true },
    entity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    heldIn: { type: Schema.Types.ObjectId, ref: 'Fund' },
    balance: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

fundSchema.index({ name: 1 }, { unique: true });

export const Fund = mongoose.model<IFund>('Fund', fundSchema);
