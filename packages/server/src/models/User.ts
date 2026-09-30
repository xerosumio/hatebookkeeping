import mongoose, { Document, Schema } from 'mongoose';

export interface IApiToken {
  _id: mongoose.Types.ObjectId;
  token: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'user';
  active: boolean;
  mustChangePassword: boolean;
  bankName: string;
  bankAccountNumber: string;
  fpsPhone: string;
  signatureUrl: string;
  apiTokens: IApiToken[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['admin', 'user'] },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    fpsPhone: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    apiTokens: [{
      token: { type: String, required: true },
      name: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      lastUsedAt: { type: Date, default: null },
    }],
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>('User', userSchema);
