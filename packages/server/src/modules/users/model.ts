import { Schema, model, type HydratedDocument } from 'mongoose';
import { ROLES, type Role } from '@hbk/shared';

export interface UserAttrs {
  email: string;
  authentikId?: string;
  name: string;
  role: Role;
  active: boolean;
  bankName: string;
  bankAccountNumber: string;
  fpsId: string;
  lastSignInAt: Date | null;
}

const userSchema = new Schema<UserAttrs>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    authentikId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ROLES },
    active: { type: Boolean, default: true },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    fpsId: { type: String, default: '' },
    lastSignInAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const User = model<UserAttrs>('User', userSchema);
export type UserDoc = HydratedDocument<UserAttrs>;
