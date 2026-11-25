import * as client from 'openid-client';
import { AppError } from '../platform/errors.js';
import { config } from '../platform/runtime.js';

export interface OidcProfile {
  sub: string;
  email: string;
  name?: string;
  groups: string[];
}

let cached: client.Configuration | undefined;

async function oidcConfig(): Promise<client.Configuration> {
  if (cached) return cached;
  const cfg = config();
  const issuer = new URL(cfg.oidcIssuer);
  // Plain http is only ever accepted outside production, for a local stand-in provider.
  const allowHttp = !cfg.isProduction && issuer.protocol === 'http:';
  try {
    cached = await client.discovery(
      issuer,
      cfg.oidcClientId,
      cfg.oidcClientSecret,
      undefined,
      allowHttp ? { execute: [client.allowInsecureRequests] } : undefined,
    );
    return cached;
  } catch (err) {
    console.error('[oidc] discovery failed', err);
    throw new AppError(
      502,
      'Sign-in is not available: the identity provider could not be reached. Check OIDC_ISSUER.',
    );
  }
}

export function resetOidc(): void {
  cached = undefined;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export async function beginAuthorization(redirectUri: string): Promise<AuthorizationRequest> {
  const oidc = await oidcConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(oidc, {
    redirect_uri: redirectUri,
    scope: config().oidcScopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  return { url: url.href, state, nonce, codeVerifier };
}

export async function completeAuthorization(args: {
  currentUrl: URL;
  expectedState: string;
  expectedNonce: string;
  codeVerifier: string;
}): Promise<OidcProfile> {
  const oidc = await oidcConfig();

  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokens = await client.authorizationCodeGrant(oidc, args.currentUrl, {
      pkceCodeVerifier: args.codeVerifier,
      expectedState: args.expectedState,
      expectedNonce: args.expectedNonce,
    });
  } catch (err) {
    console.error('[oidc] code exchange failed', err);
    throw new AppError(400, 'Sign-in did not finish. Start again.');
  }

  const claims = tokens.claims();
  if (!claims?.sub) throw new AppError(502, 'The identity provider did not say who signed in.');

  let groups = normaliseGroups(claims.groups);
  let email = typeof claims.email === 'string' ? claims.email : undefined;
  let name = typeof claims.name === 'string' ? claims.name : undefined;

  if (!email || groups.length === 0) {
    try {
      const info = await client.fetchUserInfo(oidc, tokens.access_token, claims.sub);
      email ??= typeof info.email === 'string' ? info.email : undefined;
      name ??= typeof info.name === 'string' ? info.name : undefined;
      if (groups.length === 0) groups = normaliseGroups((info as Record<string, unknown>).groups);
    } catch (err) {
      console.warn('[oidc] userinfo lookup failed; continuing with ID token claims', err);
    }
  }

  if (!email) {
    throw new AppError(
      502,
      'The identity provider did not supply an email address. Make sure the "email" scope is granted.',
    );
  }
  return { sub: claims.sub, email, ...(name !== undefined ? { name } : {}), groups };
}

function normaliseGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}
