import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { User } from '../src/modules/users/model.js';
import { startHarness, WEB_ORIGIN, type Harness } from './support/harness.js';

let h: Harness;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());
beforeEach(() => h.reset());

const william = { sub: 'sub-william', email: 'William@Example.test', name: 'William', groups: [] as string[] };
const andy = { sub: 'sub-andy', email: 'andy@example.test', name: 'Andy', groups: [] as string[] };

describe('sign-in', () => {
  it('signs in through the identity provider and returns to the page that was asked for', async () => {
    const session = await h.signInThroughOidc(william, '/invoices?status=unpaid');
    assert.equal(session.returnTo, `${WEB_ORIGIN}/invoices?status=unpaid`);

    const me = await h.as(session.token).get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'william@example.test');
    assert.equal(me.body.name, 'William');
    assert.ok(me.body.permissions.includes('settings.manage'));
  });

  it('makes the first person admin when no admin group is configured, and later people staff', async () => {
    const first = await h.signInThroughOidc(william);
    const second = await h.signInThroughOidc(andy);
    assert.equal((await h.as(first.token).get('/auth/me')).body.role, 'admin');
    assert.equal((await h.as(second.token).get('/auth/me')).body.role, 'staff');
  });

  it('takes admins from the Authentik group when one is configured', async () => {
    h.setAdminGroup('hbk-admins');
    const outsider = await h.signInThroughOidc(andy);
    const member = await h.signInThroughOidc({ ...william, groups: ['hbk-admins'] });
    assert.equal((await h.as(outsider.token).get('/auth/me')).body.role, 'staff');
    assert.equal((await h.as(member.token).get('/auth/me')).body.role, 'admin');
  });

  it('does not demote an admin whose group claim is missing on a later sign-in', async () => {
    h.setAdminGroup('hbk-admins');
    await h.signInThroughOidc({ ...william, groups: ['hbk-admins'] });
    const again = await h.signInThroughOidc({ ...william, groups: [] });
    assert.equal((await h.as(again.token).get('/auth/me')).body.role, 'admin');
    assert.equal(await User.countDocuments({}), 1);
  });

  it('lets a sign-in ticket be used once only', async () => {
    h.oidc.signInAs(william);
    const login = await request(h.app).get('/api/auth/login');
    const atProvider = await fetch(login.headers.location!, { redirect: 'manual' });
    const callback = new URL(atProvider.headers.get('location')!);
    const back = await request(h.app).get(callback.pathname + callback.search);
    const ticket = new URL(back.headers.location!).searchParams.get('ticket');

    const first = await request(h.app).post('/api/auth/complete').send({ ticket });
    const second = await request(h.app).post('/api/auth/complete').send({ ticket });
    assert.equal(first.status, 200);
    assert.equal(second.status, 400);
    assert.match(second.body.error, /already used/);
  });

  it('never redirects to another site after sign-in', async () => {
    const session = await h.signInThroughOidc(william, 'https://evil.example/steal');
    assert.equal(session.returnTo, `${WEB_ORIGIN}/`);
  });

  it('shows a failed sign-in on the web app instead of a raw error', async () => {
    h.oidc.signInAs(william);
    h.oidc.failNextTokenExchange();
    const login = await request(h.app).get('/api/auth/login');
    const atProvider = await fetch(login.headers.location!, { redirect: 'manual' });
    const callback = new URL(atProvider.headers.get('location')!);
    const back = await request(h.app).get(callback.pathname + callback.search);
    const landing = new URL(back.headers.location!);
    assert.equal(landing.origin, WEB_ORIGIN);
    assert.equal(landing.pathname, '/auth/callback');
    assert.equal(landing.searchParams.get('ticket'), null);
    assert.match(landing.searchParams.get('error')!, /did not finish/);
    assert.equal(await User.countDocuments({}), 0);
  });
});

describe('sessions', () => {
  it('refuses requests with no token or a made-up token', async () => {
    assert.equal((await h.as(null).get('/auth/me')).status, 401);
    assert.equal((await h.as('hbk_web_not-a-real-token').get('/auth/me')).status, 401);
    assert.equal((await h.as(null).get('/users')).status, 401);
  });

  it('ends the session on sign-out, so the same token stops working', async () => {
    const admin = await h.user('admin');
    assert.equal((await h.as(admin).get('/auth/me')).status, 200);
    assert.equal((await h.as(admin).post('/auth/logout')).status, 204);
    assert.equal((await h.as(admin).get('/auth/me')).status, 401);
  });

  it('ends a person’s sessions when they are switched off, and refuses their next sign-in', async () => {
    const admin = await h.user('admin');
    const session = await h.signInThroughOidc(andy);
    const andyId = (await h.as(session.token).get('/auth/me')).body.id;

    const off = await h.as(admin).put(`/users/${andyId}`, { role: 'staff', active: false });
    assert.equal(off.status, 200);
    assert.equal((await h.as(session.token).get('/auth/me')).status, 401);
    await assert.rejects(h.signInThroughOidc(andy), /switched off/);
  });
});

describe('users', () => {
  it('keeps the user list, with everyone’s bank details, to admins', async () => {
    const admin = await h.user('admin');
    const bookkeeper = await h.user('bookkeeper');
    const staff = await h.user('staff');
    assert.equal((await h.as(admin).get('/users')).status, 200);
    assert.equal((await h.as(bookkeeper).get('/users')).status, 403);
    assert.equal((await h.as(staff).get('/users')).status, 403);
    assert.equal((await h.as(staff).put(`/users/${admin.id}`, { role: 'staff', active: true })).status, 403);
  });

  it('stops the last admin from removing their own admin role or switching themselves off', async () => {
    const admin = await h.user('admin');
    const demote = await h.as(admin).put(`/users/${admin.id}`, { role: 'bookkeeper', active: true });
    assert.equal(demote.status, 409);
    assert.match(demote.body.error, /only admin/);
    const off = await h.as(admin).put(`/users/${admin.id}`, { role: 'admin', active: false });
    assert.equal(off.status, 409);

    const second = await h.user('admin');
    const allowed = await h.as(admin).put(`/users/${admin.id}`, { role: 'bookkeeper', active: true });
    assert.equal(allowed.status, 200);
    assert.equal((await h.as(second).get('/users')).status, 200);
  });

  it('lets anyone update their own payout details and nothing else', async () => {
    const staff = await h.user('staff');
    const saved = await h.as(staff).put('/users/me', { bankName: 'HSBC', bankAccountNumber: '123-456', role: 'admin' });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.bankName, 'HSBC');
    assert.equal(saved.body.role, 'staff');
  });

  it('answers unknown addresses and bad input with a clear message', async () => {
    const admin = await h.user('admin');
    const missing = await h.as(admin).get('/nothing-here');
    assert.equal(missing.status, 404);
    const bad = await h.as(admin).put(`/users/${admin.id}`, { role: 'owner', active: true });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.fields.role, 'Choose a role');
  });
});
