/**
 * A complete local copy of the API for trying the app by hand:
 * an in-memory MongoDB (emptied on every restart), a stand-in sign-in page
 * instead of Authentik, and emails printed to this terminal instead of sent.
 *
 *   npm run dev:local        (from the repository root; also starts the web app)
 *
 * Never used in production.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { setEmailTransport } from '../src/integrations/email.js';
import { startScheduler } from '../src/jobs/scheduler.js';
import { User } from '../src/modules/users/model.js';
import { connectDb } from '../src/platform/db.js';
import { setConfig } from '../src/platform/runtime.js';
import { startStubOidc, type StubUser } from './support/stubOidc.js';

const PORT = Number(process.env.PORT ?? 3000);
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? `http://localhost:${WEB_PORT}`;

const PEOPLE: (StubUser & { role: 'admin' | 'bookkeeper' | 'staff' })[] = [
  { sub: 'dev-admin', email: 'admin@example.test', name: 'Alex Admin', groups: ['hbk-admins'], role: 'admin' },
  { sub: 'dev-admin-2', email: 'second.admin@example.test', name: 'Sam Second-Admin', groups: ['hbk-admins'], role: 'admin' },
  { sub: 'dev-bookkeeper', email: 'bookkeeper@example.test', name: 'Bo Bookkeeper', groups: [], role: 'bookkeeper' },
  { sub: 'dev-staff', email: 'staff@example.test', name: 'Stevie Staff', groups: [], role: 'staff' },
];

async function start() {
  const mongo = await MongoMemoryServer.create();
  const oidc = await startStubOidc({ port: PORT + 1, choices: PEOPLE });

  setConfig({
    nodeEnv: 'development',
    isProduction: false,
    port: PORT,
    publicUrl: `http://localhost:${PORT}`,
    webOrigin: WEB_ORIGIN,
    mongodbUri: mongo.getUri('hbk-local'),
    oidcIssuer: oidc.issuer,
    oidcClientId: oidc.clientId,
    oidcClientSecret: oidc.clientSecret,
    oidcScopes: 'openid profile email',
    oidcAdminGroup: 'hbk-admins',
    sessionSecret: 'local-development-session-secret-0123456789abcdef',
    emailApiUrl: '',
    emailApiKey: '',
  });

  setEmailTransport(async (email) => {
    console.log(`[email] to ${email.to.join(', ')} — ${email.subject}`);
  });

  const app = createApp();
  await connectDb(mongo.getUri('hbk-local'));
  for (const person of PEOPLE) {
    await User.create({ authentikId: person.sub, email: person.email, name: person.name, role: person.role, active: true });
  }
  startScheduler();

  app.listen(PORT, () => {
    console.log(`Local API on http://localhost:${PORT} (stand-in sign-in on ${oidc.issuer}, empty in-memory database)`);
    console.log(`Open ${WEB_ORIGIN} and sign in as one of: ${PEOPLE.map((person) => person.name).join(', ')}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
