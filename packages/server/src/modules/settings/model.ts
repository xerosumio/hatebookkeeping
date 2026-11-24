import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { CATEGORY_TYPES, type CategoryType, type SystemCategory } from '@hbk/shared';

export interface CategoryAttrs {
  _id: Types.ObjectId;
  name: string;
  type: CategoryType;
  active: boolean;
  system: SystemCategory | null;
}

export interface SettingsAttrs {
  key: 'main';
  categories: Types.DocumentArray<CategoryAttrs>;
  approverIds: Types.ObjectId[];
  approvalsRequired: number;
}

const categorySchema = new Schema<CategoryAttrs>({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: CATEGORY_TYPES, required: true },
  active: { type: Boolean, default: true },
  system: { type: String, enum: ['sales', 'salary', null], default: null },
});

const settingsSchema = new Schema<SettingsAttrs>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    categories: { type: [categorySchema], default: [] },
    approverIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    approvalsRequired: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true, optimisticConcurrency: true },
);

export const Settings = model<SettingsAttrs>('Settings', settingsSchema);
export type SettingsDoc = HydratedDocument<SettingsAttrs>;

export const DEFAULT_CATEGORIES: Pick<CategoryAttrs, 'name' | 'type' | 'system'>[] = [
  { name: 'Sales', type: 'income', system: 'sales' },
  { name: 'Other income', type: 'income', system: null },
  { name: 'Bank interest', type: 'income', system: null },
  { name: 'Salary', type: 'expense', system: 'salary' },
  { name: 'Rent', type: 'expense', system: null },
  { name: 'Utilities', type: 'expense', system: null },
  { name: 'Software and subscriptions', type: 'expense', system: null },
  { name: 'Professional fees', type: 'expense', system: null },
  { name: 'Suppliers and contractors', type: 'expense', system: null },
  { name: 'Travel and transport', type: 'expense', system: null },
  { name: 'Meals and entertainment', type: 'expense', system: null },
  { name: 'Office supplies', type: 'expense', system: null },
  { name: 'Tax and government fees', type: 'expense', system: null },
  { name: 'Other expense', type: 'expense', system: null },
];
