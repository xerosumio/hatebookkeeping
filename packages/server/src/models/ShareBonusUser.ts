import mongoose, { Document, Schema } from 'mongoose';

export interface IShareBonusUser extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  bonusPercent: number;
  payee?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const shareBonusUserSchema = new Schema<IShareBonusUser>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    bonusPercent: { type: Number, required: true, min: 0, max: 100 },
    payee: { type: Schema.Types.ObjectId, ref: 'Payee' },
  },
  { timestamps: true },
);

shareBonusUserSchema.index({ user: 1 }, { unique: true });

export const ShareBonusUser = mongoose.model<IShareBonusUser>('ShareBonusUser', shareBonusUserSchema);
