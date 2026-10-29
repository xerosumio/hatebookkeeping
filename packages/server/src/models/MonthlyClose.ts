import mongoose, { Document, Schema } from 'mongoose';

export interface IDistributionEntry {
  shareholder: mongoose.Types.ObjectId;
  sharePercent: number;
  amount: number;
  equityTransaction?: mongoose.Types.ObjectId;
  method?: 'cash' | 'offset_liability';
  liabilityOffset?: number;
}

export interface IBonusDistributionEntry {
  bonusUser: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  name: string;
  percent: number;
  amount: number;
}

export interface ITakeOutSnapshot {
  operatingCash: number;
  pendingOut: number;
  available: number;
  direction: 'pay_in' | 'take_out' | 'even';
  bonusTotal: number;
  afterBonus: number;
}

export interface IApprovalEntry {
  user: mongoose.Types.ObjectId;
  at: Date;
}

export interface IActivityLogEntry {
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'finalized' | 'notified' | 'reopened';
  user: mongoose.Types.ObjectId;
  timestamp: Date;
  note?: string;
}

export interface IMonthlyClose extends Document {
  entity: mongoose.Types.ObjectId;
  year: number;
  month: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'finalized';
  openingCash: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  availableCash: number;
  shareholderDistribution: number;
  companyReserve: number;
  staffReserve: number;
  closingCash: number;
  distributions: IDistributionEntry[];
  bonusDistributions: IBonusDistributionEntry[];
  takeOut?: ITakeOutSnapshot;
  paymentRequest?: mongoose.Types.ObjectId;
  staffReserveFund?: mongoose.Types.ObjectId;
  companyReserveFund?: mongoose.Types.ObjectId;
  reserveHeldIn?: mongoose.Types.ObjectId;
  isLoss: boolean;
  approvals: IApprovalEntry[];
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  closedBy?: mongoose.Types.ObjectId;
  closedAt?: Date;
  notifiedEmails: string[];
  activityLog: IActivityLogEntry[];
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
    method: { type: String, enum: ['cash', 'offset_liability'], default: 'cash' },
    liabilityOffset: { type: Number },
  },
  { _id: false },
);

const bonusDistributionEntrySchema = new Schema<IBonusDistributionEntry>(
  {
    bonusUser: { type: Schema.Types.ObjectId, ref: 'ShareBonusUser', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    percent: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const takeOutSnapshotSchema = new Schema<ITakeOutSnapshot>(
  {
    operatingCash: { type: Number, required: true },
    pendingOut: { type: Number, required: true },
    available: { type: Number, required: true },
    direction: { type: String, enum: ['pay_in', 'take_out', 'even'], required: true },
    bonusTotal: { type: Number, default: 0 },
    afterBonus: { type: Number, default: 0 },
  },
  { _id: false },
);

const approvalEntrySchema = new Schema<IApprovalEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const activityLogEntrySchema = new Schema<IActivityLogEntry>(
  {
    action: { type: String, enum: ['created', 'submitted', 'approved', 'rejected', 'finalized', 'notified', 'reopened'], required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const monthlyCloseSchema = new Schema<IMonthlyClose>(
  {
    entity: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected', 'finalized'],
      default: 'draft',
    },
    openingCash: { type: Number, default: 0 },
    totalIncome: { type: Number, required: true },
    totalExpense: { type: Number, required: true },
    netProfit: { type: Number, required: true },
    availableCash: { type: Number, default: 0 },
    shareholderDistribution: { type: Number, default: 0 },
    companyReserve: { type: Number, default: 0 },
    staffReserve: { type: Number, default: 0 },
    closingCash: { type: Number, default: 0 },
    distributions: [distributionEntrySchema],
    bonusDistributions: [bonusDistributionEntrySchema],
    takeOut: { type: takeOutSnapshotSchema },
    paymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest' },
    staffReserveFund: { type: Schema.Types.ObjectId, ref: 'Fund' },
    companyReserveFund: { type: Schema.Types.ObjectId, ref: 'Fund' },
    reserveHeldIn: { type: Schema.Types.ObjectId, ref: 'Fund' },
    isLoss: { type: Boolean, default: false },
    approvals: [approvalEntrySchema],
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    notifiedEmails: [{ type: String }],
    activityLog: [activityLogEntrySchema],
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

monthlyCloseSchema.index({ entity: 1, year: 1, month: 1 }, { unique: true });

export const MonthlyClose = mongoose.model<IMonthlyClose>('MonthlyClose', monthlyCloseSchema);
