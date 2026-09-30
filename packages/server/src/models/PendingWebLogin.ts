import { Schema, model, type HydratedDocument, type InferSchemaType, type Types } from 'mongoose';

const PendingWebLoginSchema = new Schema(
  {
    state: { type: String, required: true, unique: true },
    nonce: { type: String, required: true },
    codeVerifier: { type: String, required: true },
    returnTo: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'pendingWebLogins' },
);

PendingWebLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PendingWebLoginAttrs = InferSchemaType<typeof PendingWebLoginSchema>;
export type PendingWebLoginDoc = HydratedDocument<PendingWebLoginAttrs>;
export type PendingWebLoginLean = PendingWebLoginAttrs & { _id: Types.ObjectId };

export const PendingWebLogin = model('PendingWebLogin', PendingWebLoginSchema);
