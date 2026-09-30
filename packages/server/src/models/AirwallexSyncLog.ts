import mongoose, { Document, Schema } from 'mongoose';

export interface IAirwallexSyncLog extends Document {
  entity: 'ax' | 'nt';
  status: 'running' | 'success' | 'error';
  startedAt: Date;
  completedAt?: Date;
  bankBalance?: number;
  systemBalance?: number;
  discrepancy?: number;
  matched: number;
  created: number;
  unmatched: number;
  unmatchedItems: Array<{ airwallexId: string; amount: number; date: string; description: string }>;
  error?: string;
}

const airwallexSyncLogSchema = new Schema<IAirwallexSyncLog>(
  {
    entity: { type: String, enum: ['ax', 'nt'], required: true },
    status: { type: String, enum: ['running', 'success', 'error'], required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    bankBalance: { type: Number },
    systemBalance: { type: Number },
    discrepancy: { type: Number },
    matched: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    unmatched: { type: Number, default: 0 },
    unmatchedItems: [
      {
        airwallexId: String,
        amount: Number,
        date: String,
        description: String,
      },
    ],
    error: { type: String },
  },
  { timestamps: true },
);

airwallexSyncLogSchema.index({ entity: 1, startedAt: -1 });

export const AirwallexSyncLog = mongoose.model<IAirwallexSyncLog>(
  'AirwallexSyncLog',
  airwallexSyncLogSchema,
);
