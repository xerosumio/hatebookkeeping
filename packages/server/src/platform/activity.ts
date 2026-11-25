import { Schema, type Types } from 'mongoose';
import type { ActivityDto, ApprovalDto } from '@hbk/shared';

export interface ActivityAttrs {
  at: Date;
  userId: Types.ObjectId | null;
  userName: string;
  action: string;
  note: string;
}

export const activitySchema = new Schema<ActivityAttrs>(
  {
    at: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },
    action: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { _id: false },
);

export interface ApprovalAttrs {
  userId: Types.ObjectId;
  userName: string;
  at: Date;
}

export const approvalSchema = new Schema<ApprovalAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

export interface Actor {
  _id: Types.ObjectId;
  name: string;
}

export function activityEntry(actor: Actor | null, action: string, note = ''): ActivityAttrs {
  return {
    at: new Date(),
    userId: actor?._id ?? null,
    userName: actor?.name ?? 'System',
    action,
    note,
  };
}

/** Adds a line to a document's history. The caller saves the document. */
export function record(doc: { activity: ActivityAttrs[] }, actor: Actor | null, action: string, note = ''): void {
  doc.activity.push(activityEntry(actor, action, note));
}

export function activityDto(entry: ActivityAttrs): ActivityDto {
  return { at: entry.at.toISOString(), userName: entry.userName, action: entry.action, note: entry.note };
}

export function approvalDto(entry: ApprovalAttrs): ApprovalDto {
  return { userId: String(entry.userId), userName: entry.userName, at: entry.at.toISOString() };
}
