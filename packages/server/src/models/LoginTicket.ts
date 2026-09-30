import { Schema, model, type HydratedDocument, type InferSchemaType, type Types } from 'mongoose';

const LoginTicketSchema = new Schema(
  {
    ticketHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    returnTo: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'loginTickets' },
);

LoginTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginTicketAttrs = InferSchemaType<typeof LoginTicketSchema>;
export type LoginTicketDoc = HydratedDocument<LoginTicketAttrs>;
export type LoginTicketLean = LoginTicketAttrs & { _id: Types.ObjectId };

export const LoginTicket = model('LoginTicket', LoginTicketSchema);
