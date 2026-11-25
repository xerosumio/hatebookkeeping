import type { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Role } from '@hbk/shared';
import { createApp } from '../../src/app.js';
import { resetOidc } from '../../src/integrations/oidc.js';
import { setEmailTransport, type OutgoingEmail } from '../../src/integrations/email.js';
import { startSession } from '../../src/modules/auth/tokens.js';
import { User, type UserDoc } from '../../src/modules/users/model.js';
import type { Config } from '../../src/platform/config.js';
import { connectDb, disconnectDb } from '../../src/platform/db.js';
import { config, setConfig } from '../../src/platform/runtime.js';
import { startStubOidc, type StubOidc, type StubUser } from './stubOidc.js';

export const API_ORIGIN = 'http://api.test';
export const WEB_ORIGIN = 'http://web.test';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
  doc: UserDoc;
}

export interface Client {
  get(path: string): request.Test;
  post(path: string, body?: unknown): request.Test;
  put(path: string, body?: unknown): request.Test;
  delete(path: string): request.Test;
}

export interface Harness {
  app: Express;
  oidc: StubOidc;
  /** Every email the app tried to send since the last reset. */
  emails: OutgoingEmail[];
  /** Makes email sending fail with this reason; null restores delivery. */
  failEmails(reason: string | null): void;
  /** Behaves as if no email service is configured. */
  disableEmails(): void;
  setAdminGroup(group: string): void;
  /** Creates a user directly and signs them in. */
  user(role: Role, name?: string): Promise<TestUser>;
  as(user: TestUser | string | null): Client;
  /** Runs the real sign-in flow against the stand-in provider. */
  signInThroughOidc(user: StubUser, returnTo?: string): Promise<{ token: string; returnTo: string }>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

let counter = 0;

export async function startHarness(): Promise<Harness> {
  const mongo = await MongoMemoryServer.create();
  const oidc = await startStubOidc();

  const base: Config = {
    nodeEnv: 'test',
    isProduction: false,
    port: 0,
    publicUrl: API_ORIGIN,
    webOrigin: WEB_ORIGIN,
    mongodbUri: mongo.getUri('hbk-test'),
    oidcIssuer: oidc.issuer,
    oidcClientId: oidc.clientId,
    oidcClientSecret: oidc.clientSecret,
    oidcScopes: 'openid profile email',
    oidcAdminGroup: '',
    sessionSecret: 'test-session-secret-that-is-long-enough-0123456789',
    emailApiUrl: '',
    emailApiKey: '',
  };
  setConfig(base);
  resetOidc();

  const app = createApp();
  await connectDb(base.mongodbUri);

  const emails: OutgoingEmail[] = [];
  let emailFailure: string | null = null;
  const capture = async (email: OutgoingEmail) => {
    emails.push(email);
    if (emailFailure) throw new Error(emailFailure);
  };
  setEmailTransport(capture);

  const client = (token: string | null): Client => {
    const withAuth = (test: request.Test) => (token ? test.set('Authorization', `Bearer ${token}`) : test);
    return {
      get: (path) => withAuth(request(app).get(`/api${path}`)),
      post: (path, body) => withAuth(request(app).post(`/api${path}`)).send((body ?? {}) as object),
      put: (path, body) => withAuth(request(app).put(`/api${path}`)).send((body ?? {}) as object),
      delete: (path) => withAuth(request(app).delete(`/api${path}`)),
    };
  };

  return {
    app,
    oidc,
    emails,
    failEmails(reason) {
      emailFailure = reason;
      setEmailTransport(capture);
    },
    disableEmails() {
      setEmailTransport(null);
    },
    setAdminGroup(group) {
      setConfig({ ...config(), oidcAdminGroup: group });
    },
    async user(role, name) {
      counter += 1;
      const displayName = name ?? `${role[0]!.toUpperCase()}${role.slice(1)} ${counter}`;
      const doc = await User.create({
        email: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${counter}@example.test`,
        name: displayName,
        role,
        active: true,
      });
      const token = await startSession(String(doc._id));
      return { id: String(doc._id), name: doc.name, email: doc.email, token, doc };
    },
    as(user) {
      return client(typeof user === 'string' || user === null ? user : user.token);
    },
    async signInThroughOidc(user, returnTo) {
      oidc.signInAs(user);
      const login = await request(app).get('/api/auth/login').query(returnTo ? { returnTo } : {});
      if (login.status !== 302) throw new Error(`login answered ${login.status}: ${JSON.stringify(login.body)}`);
      const atProvider = await fetch(login.headers.location!, { redirect: 'manual' });
      const callback = new URL(atProvider.headers.get('location')!);
      const back = await request(app).get(callback.pathname + callback.search);
      const landing = new URL(back.headers.location!);
      const ticket = landing.searchParams.get('ticket');
      if (!ticket) throw new Error(landing.searchParams.get('error') ?? 'no ticket');
      const complete = await request(app).post('/api/auth/complete').send({ ticket });
      if (complete.status !== 200) throw new Error(complete.body.error);
      return complete.body as { token: string; returnTo: string };
    },
    async reset() {
      await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
      emails.length = 0;
      emailFailure = null;
      setEmailTransport(capture);
      setConfig(base);
    },
    async stop() {
      setEmailTransport(undefined);
      await disconnectDb();
      await Promise.all([mongo.stop(), oidc.stop()]);
    },
  };
}
