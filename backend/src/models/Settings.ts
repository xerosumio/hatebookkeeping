import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBankAccount {
  name: string;
  bankName: string;
  accountNumber: string;
}

export interface IChartOfAccount {
  code: string;
  name: string;
  type: 'income' | 'expense';
  active: boolean;
}

export interface ISettings extends Document {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  bankAccountInfo: string;
  bankAccounts: IBankAccount[];
  chartOfAccounts: IChartOfAccount[];
  companyChopUrl: string;
  signatureUrl: string;
  defaultEntityId: mongoose.Types.ObjectId;
}

const settingsSchema = new Schema<ISettings>(
  {
    companyName: { type: String, default: 'My Company' },
    companyAddress: { type: String, default: '' },
    companyPhone: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    companyWebsite: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    bankAccountInfo: { type: String, default: '' },
    bankAccounts: {
      type: [{
        name: { type: String, required: true },
        bankName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
      }],
      default: [],
    },
    chartOfAccounts: {
      type: [{
        code: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['income', 'expense'], required: true },
        active: { type: Boolean, default: true },
      }],
      default: [],
    },
    companyChopUrl: { type: String, default: '' },
    signatureUrl: { type: String, default: '' },
    defaultEntityId: { type: Schema.Types.ObjectId, ref: 'Entity' },
  },
  { timestamps: true },
);

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);

const DEFAULT_COA: IChartOfAccount[] = [
  { code: '4000', name: 'Revenue', type: 'income', active: true },
  { code: '4900', name: 'Other Income', type: 'income', active: true },
  { code: '5100', name: 'Salary', type: 'expense', active: true },
  { code: '5200', name: 'Reimbursement', type: 'expense', active: true },
  { code: '5300', name: 'Rent', type: 'expense', active: true },
  { code: '5400', name: 'Utilities', type: 'expense', active: true },
  { code: '5500', name: 'Software Subscription', type: 'expense', active: true },
  { code: '5600', name: 'Professional Fees', type: 'expense', active: true },
  { code: '5700', name: 'Tax', type: 'expense', active: true },
  { code: '5800', name: 'Vendor Payment', type: 'expense', active: true },
  { code: '5900', name: 'Other Expense', type: 'expense', active: true },
];

export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ chartOfAccounts: DEFAULT_COA });
  } else if (!settings.chartOfAccounts || settings.chartOfAccounts.length === 0) {
    settings.chartOfAccounts = DEFAULT_COA;
    await settings.save();
  }
  return settings;
}
