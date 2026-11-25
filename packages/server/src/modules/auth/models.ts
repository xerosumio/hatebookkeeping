import { Schema, model, type Types } from 'mongoose';

/** PKCE state held between leaving for Authentik and coming back. */
interface PendingLoginAttrs {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
  expiresAt: Date;
}

const pendingLoginSchema = new Schema<PendingLoginAttrs>({
  state: { type: String, required: true, unique: true },
  nonce: { type: String, required: true },
  codeVerifier: { type: String, required: true },
  returnTo: { type: String, default: null },
  expiresAt: { type: Date, required: true },
});
pendingLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingLogin = model<PendingLoginAttrs>('PendingLogin', pendingLoginSchema);

/** One-time ticket the web app swaps for a session token. Only its hash is stored. */
interface LoginTicketAttrs {
  ticketHash: string;
  userId: Types.ObjectId;
  returnTo: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

const loginTicketSchema = new Schema<LoginTicketAttrs>({
  ticketHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  returnTo: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
});
loginTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginTicket = model<LoginTicketAttrs>('LoginTicket', loginTicketSchema);

/**
 * A signed-in browser. A token is only honoured while its session row exists,
 * so signing out (or deactivating the user) ends it immediately.
 */
interface SessionAttrs {
  jti: string;
  userId: Types.ObjectId;
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionAttrs>(
  {
    jti: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<SessionAttrs>('Session', sessionSchema);
