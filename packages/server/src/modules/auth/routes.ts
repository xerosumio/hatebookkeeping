import { Router } from 'express';
import * as oidc from '../../integrations/oidc.js';
import { currentUser, requireAuth } from '../../platform/auth.js';
import { resolveReturnTo } from '../../platform/cors.js';
import { AppError } from '../../platform/errors.js';
import { route } from '../../platform/http.js';
import { config } from '../../platform/runtime.js';
import { approvalPolicy } from '../settings/service.js';
import { meDto } from '../users/routes.js';
import {
  consumeLoginTicket,
  issueLoginTicket,
  rememberPendingLogin,
  takePendingLogin,
  upsertFromOidc,
} from './service.js';
import { endSession, startSession } from './tokens.js';

const router = Router();

/** Begins a sign-in: sends the browser to Authentik. */
router.get(
  '/login',
  route(async (req, res) => {
    const redirectUri = new URL('/api/auth/callback', config().publicUrl).toString();
    const request = await oidc.beginAuthorization(redirectUri);
    await rememberPendingLogin({
      state: request.state,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      returnTo: typeof req.query.returnTo === 'string' ? req.query.returnTo : null,
    });
    res.redirect(request.url);
  }),
);

/**
 * Authentik's return leg. Failures are shown on the web app's own page rather
 * than as raw JSON on the API origin.
 */
router.get('/callback', (req, res) => {
  const cfg = config();
  const destination = new URL('/auth/callback', cfg.webOrigin);
  (async () => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state) throw new AppError(400, 'There is no sign-in in progress. Start again.');
    const pending = await takePendingLogin(state);
    const profile = await oidc.completeAuthorization({
      currentUrl: new URL(req.originalUrl, cfg.publicUrl),
      expectedState: pending.state,
      expectedNonce: pending.nonce,
      codeVerifier: pending.codeVerifier,
    });
    const user = await upsertFromOidc(profile);
    const ticket = await issueLoginTicket(String(user._id), resolveReturnTo(pending.returnTo, cfg.webOrigin));
    destination.searchParams.set('ticket', ticket);
  })()
    .catch((err: unknown) => {
      if (!(err instanceof AppError)) console.error('[auth] callback failed', err);
      destination.searchParams.set('error', err instanceof AppError ? err.message : 'Sign-in did not finish.');
    })
    .finally(() => res.redirect(destination.toString()));
});

/** Swaps the one-time ticket for a session token. */
router.post(
  '/complete',
  route(async (req, res) => {
    const raw = typeof req.body?.ticket === 'string' ? req.body.ticket : '';
    const redeemed = await consumeLoginTicket(raw);
    const token = await startSession(redeemed.userId);
    res.json({ token, returnTo: redeemed.returnTo });
  }),
);

/** Ends this session on the server, so the token stops working at once. */
router.post(
  '/logout',
  requireAuth,
  route(async (req, res) => {
    await endSession(req.auth!.jti);
    res.status(204).end();
  }),
);

router.get(
  '/me',
  requireAuth,
  route(async (req, res) => {
    res.json(meDto(currentUser(req), await approvalPolicy()));
  }),
);

export default router;
