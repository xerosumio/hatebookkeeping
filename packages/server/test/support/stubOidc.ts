import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

/**
 * A stand-in for Authentik: just enough OpenID Connect (authorization code +
 * PKCE, RS256 ID tokens) for the real sign-in code to run against it. Used by
 * the tests and by the local dev server. Never used in production.
 */

export interface StubUser {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

interface PendingCode {
  user: StubUser;
  nonce: string | undefined;
  challenge: string;
  redirectUri: string;
}

export interface StubOidc {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** The person the next /authorize request signs in as (tests). */
  signInAs(user: StubUser): void;
  /** Makes the next token exchange fail, as if the provider rejected it. */
  failNextTokenExchange(): void;
  stop(): Promise<void>;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function startStubOidc(options: { port?: number; choices?: StubUser[] } = {}): Promise<StubOidc> {
  const clientId = 'hbk-test-client';
  const clientSecret = 'hbk-test-secret';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'stub', alg: 'RS256', use: 'sig' };

  const codes = new Map<string, PendingCode>();
  const accessTokens = new Map<string, StubUser>();
  let nextUser: StubUser | undefined;
  let failToken = false;
  let issuer = '';

  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    });
  });

  app.get('/jwks', (_req, res) => {
    res.json({ keys: [jwk] });
  });

  app.get('/authorize', (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const redirectUri = query.redirect_uri ?? '';
    const finish = (user: StubUser) => {
      const code = randomBytes(16).toString('hex');
      codes.set(code, { user, nonce: query.nonce, challenge: query.code_challenge ?? '', redirectUri });
      const destination = new URL(redirectUri);
      destination.searchParams.set('code', code);
      if (query.state) destination.searchParams.set('state', query.state);
      res.redirect(destination.toString());
    };

    const picked = options.choices?.find((choice) => choice.sub === query.pick);
    if (picked) return finish(picked);
    if (nextUser) return finish(nextUser);

    if (options.choices?.length) {
      const here = new URL(req.originalUrl, issuer);
      const links = options.choices
        .map((choice) => {
          here.searchParams.set('pick', choice.sub);
          return `<li><a href="${escapeHtml(here.pathname + here.search)}">${escapeHtml(choice.name)}</a> <small>${escapeHtml(choice.email)} · ${escapeHtml(choice.groups.join(', ') || 'no groups')}</small></li>`;
        })
        .join('');
      res.send(
        `<!doctype html><meta charset="utf-8"><title>Stand-in sign-in</title>` +
          `<body style="font-family:system-ui;max-width:520px;margin:60px auto;line-height:1.9">` +
          `<h1 style="font-size:20px">Stand-in sign-in (local only)</h1><p>Choose who to sign in as:</p><ul>${links}</ul></body>`,
      );
      return;
    }
    res.status(400).send('No stub user selected');
  });

  app.post('/token', async (req, res) => {
    if (failToken) {
      failToken = false;
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    const body = req.body as Record<string, string | undefined>;
    const pending = body.code ? codes.get(body.code) : undefined;
    if (body.code) codes.delete(body.code);

    const basic = req.headers.authorization?.startsWith('Basic ')
      ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString().split(':')
      : [];
    const givenSecret = body.client_secret ?? (basic[1] ? decodeURIComponent(basic[1]) : undefined);
    const challenge = createHash('sha256').update(body.code_verifier ?? '').digest('base64url');

    if (!pending || givenSecret !== clientSecret || challenge !== pending.challenge || body.redirect_uri !== pending.redirectUri) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    const accessToken = randomBytes(16).toString('hex');
    accessTokens.set(accessToken, pending.user);
    const idToken = await new SignJWT({
      email: pending.user.email,
      name: pending.user.name,
      groups: pending.user.groups,
      ...(pending.nonce ? { nonce: pending.nonce } : {}),
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'stub' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(pending.user.sub)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 300, id_token: idToken });
  });

  app.get('/userinfo', (req, res) => {
    const user = accessTokens.get((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (!user) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    res.json({ sub: user.sub, email: user.email, name: user.name, groups: user.groups });
  });

  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(options.port ?? 0, '127.0.0.1', () => resolve(listening));
  });
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    issuer,
    clientId,
    clientSecret,
    signInAs(user) {
      nextUser = user;
    },
    failNextTokenExchange() {
      failToken = true;
    },
    stop: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
