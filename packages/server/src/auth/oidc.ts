import * as client from 'openid-client';
import { getConfig } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { OidcProfile } from '../services/userService.js';

let cached: client.Configuration | undefined;

export async function getOidcConfig(): Promise<client.Configuration> {
  if (cached) return cached;
  const cfg = getConfig();

  try {
    cached = await client.discovery(
      new URL(cfg.OIDC_ISSUER),
      cfg.OIDC_CLIENT_ID,
      cfg.OIDC_CLIENT_SECRET,
    );
    console.log(`[oidc] discovery complete (${cfg.OIDC_ISSUER})`);
    return cached;
  } catch (err) {
    throw new AppError(
      500,
      `Could not reach the OIDC provider at ${cfg.OIDC_ISSUER}. Check OIDC_ISSUER points at the Authentik application (https://<host>/application/o/<slug>/). ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function resetOidcConfig(): void {
  cached = undefined;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export async function beginAuthorization(redirectUri: string): Promise<AuthorizationRequest> {
  const cfg = getConfig();
  const config = await getOidcConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: cfg.OIDC_SCOPES,
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
  const config = await getOidcConfig();

  const tokens = await client.authorizationCodeGrant(config, args.currentUrl, {
    pkceCodeVerifier: args.codeVerifier,
    expectedState: args.expectedState,
    expectedNonce: args.expectedNonce,
  });

  const claims = tokens.claims();
  if (!claims?.sub) {
    throw new AppError(500, 'The identity provider returned a token without a subject claim.');
  }

  let groups = normalizeGroups(claims.groups);
  let email = typeof claims.email === 'string' ? claims.email : undefined;
  let name = typeof claims.name === 'string' ? claims.name : undefined;

  if (!email || groups.length === 0) {
    try {
      const info = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
      email ??= typeof info.email === 'string' ? info.email : undefined;
      name ??= typeof info.name === 'string' ? info.name : undefined;
      if (groups.length === 0) groups = normalizeGroups((info as Record<string, unknown>).groups);
    } catch (err) {
      console.warn('[oidc] userinfo lookup failed; continuing with ID token claims', err);
    }
  }

  if (!email) {
    throw new AppError(
      500,
      'The identity provider did not supply an email address. Ensure the "email" scope is granted and the user has an email set.',
    );
  }

  return {
    sub: claims.sub,
    email,
    ...(name !== undefined ? { name } : {}),
    groups,
  };
}

function normalizeGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}
