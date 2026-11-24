import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { CategoryDto } from '@hbk/shared';
import { PDF, PNG, upload, world, type World } from './support/fixtures.js';
import { startHarness, type Harness } from './support/harness.js';

let h: Harness;
let w: World;
before(async () => {
  h = await startHarness();
});
after(() => h.stop());
beforeEach(async () => {
  await h.reset();
  w = await world(h);
});

describe('companies', () => {
  it('lets only an admin create or change a company', async () => {
    const input = { code: 'NT', name: 'Naton Lab Limited' };
    assert.equal((await h.as(w.bookkeeper).post('/companies', input)).status, 403);
    assert.equal((await h.as(w.staff).post('/companies', input)).status, 403);
    assert.equal((await h.as(w.admin).post('/companies', input)).status, 201);
    assert.equal((await h.as(w.bookkeeper).put(`/companies/${w.company.id}`, { ...w.company, name: 'X' })).status, 403);
  });

  it('refuses a second company with the same code and says which field is wrong', async () => {
    const res = await h.as(w.admin).post('/companies', { code: 'ax', name: 'Copy' });
    assert.equal(res.status, 400);
    assert.match(res.body.fields.code, /already uses AX/);
  });

  it('shows bank details to the office but not to staff', async () => {
    const office = await h.as(w.bookkeeper).get('/companies');
    assert.match(office.body[0].bankDetails, /123-456-789/);

    const staff = await h.as(w.staff).get('/companies');
    assert.equal(staff.status, 200);
    assert.equal(staff.body[0].name, 'Axilogy Limited');
    assert.equal(staff.body[0].bankDetails, '');
    assert.equal(staff.body[0].address, '');
  });

  it('needs a sign-in to read anything', async () => {
    for (const path of ['/companies', '/settings/categories', '/settings/approval', '/users', `/files/${'a'.repeat(24)}`]) {
      assert.equal((await h.as(null).get(path)).status, 401, path);
    }
  });
});

describe('document numbers', () => {
  it('starts at 1 and can be raised but never lowered', async () => {
    const path = `/companies/${w.company.id}/numbering`;
    const start = await h.as(w.admin).get(path);
    assert.deepEqual([start.body.quote, start.body.invoice, start.body.receipt], [1, 1, 1]);

    const raised = await h.as(w.admin).put(path, { quote: 40, invoice: 120, receipt: 95 });
    assert.equal(raised.status, 200);
    assert.deepEqual([raised.body.quote, raised.body.invoice, raised.body.receipt], [40, 120, 95]);

    const lowered = await h.as(w.admin).put(path, { quote: 40, invoice: 100, receipt: 95 });
    assert.equal(lowered.status, 400);
    assert.match(lowered.body.fields.invoice, /cannot go below 120/);
    assert.equal((await h.as(w.admin).get(path)).body.invoice, 120);
  });

  it('is admin only', async () => {
    assert.equal((await h.as(w.bookkeeper).get(`/companies/${w.company.id}/numbering`)).status, 403);
  });
});

describe('categories', () => {
  it('comes with defaults, including the Sales and Salary categories the app books to', async () => {
    const systems = w.categories.filter((category) => category.system).map((category) => category.system);
    assert.deepEqual(systems.sort(), ['salary', 'sales']);
    assert.ok(w.categories.some((category) => category.name === 'Rent' && category.type === 'expense'));
  });

  it('lets staff read the list but only an admin change it', async () => {
    assert.equal((await h.as(w.staff).get('/settings/categories')).status, 200);
    assert.equal((await h.as(w.bookkeeper).post('/settings/categories', { name: 'Insurance', type: 'expense' })).status, 403);
    const created = await h.as(w.admin).post('/settings/categories', { name: 'Insurance', type: 'expense' });
    assert.equal(created.status, 201);
    assert.equal(created.body.active, true);
  });

  it('refuses a duplicate name within the same type', async () => {
    const res = await h.as(w.admin).post('/settings/categories', { name: 'rent', type: 'expense' });
    assert.equal(res.status, 400);
    assert.match(res.body.fields.name, /already an expense category/);
  });

  it('can rename and switch off a category, but not switch off one the app books to', async () => {
    const rent = w.categories.find((category) => category.name === 'Rent')!;
    const off = await h.as(w.admin).put(`/settings/categories/${rent.id}`, { name: 'Office rent', active: false });
    assert.equal(off.status, 200);
    assert.deepEqual([off.body.name, off.body.active], ['Office rent', false]);

    const salary = w.categories.find((category) => category.system === 'salary')!;
    const blocked = await h.as(w.admin).put(`/settings/categories/${salary.id}`, { name: 'Salary', active: false });
    assert.equal(blocked.status, 409);
    const renamed = await h.as(w.admin).put(`/settings/categories/${salary.id}`, { name: 'Payroll', active: true });
    assert.equal(renamed.status, 200);
    const list = (await h.as(w.admin).get('/settings/categories')).body as CategoryDto[];
    assert.equal(list.find((category) => category.system === 'salary')!.name, 'Payroll');
  });
});

describe('approvers', () => {
  it('are chosen in Settings by an admin, from admins and bookkeepers who can sign in', async () => {
    assert.equal((await h.as(w.bookkeeper).put('/settings/approval', { approverIds: [w.bookkeeper.id], approvalsRequired: 1 })).status, 403);

    const withStaff = await h.as(w.admin).put('/settings/approval', { approverIds: [w.staff.id], approvalsRequired: 1 });
    assert.equal(withStaff.status, 400);
    assert.match(withStaff.body.fields['approverIds.0'], /must be an admin or bookkeeper/);

    const ok = await h.as(w.admin).put('/settings/approval', { approverIds: [w.admin.id, w.bookkeeper.id], approvalsRequired: 2 });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { approverIds: [w.admin.id, w.bookkeeper.id], approvalsRequired: 2 });
    assert.equal((await h.as(w.admin).get('/auth/me')).body.isApprover, true);
  });

  it('cannot require more approvals than there are approvers', async () => {
    const res = await h.as(w.admin).put('/settings/approval', { approverIds: [w.bookkeeper.id], approvalsRequired: 2 });
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.approvalsRequired);
  });

  it('keeps an approver from being demoted or switched off until they are removed from the approvers', async () => {
    const res = await h.as(w.admin).put(`/users/${w.bookkeeper.id}`, { role: 'staff', active: true });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /is an approver/);
  });
});

describe('uploaded files', () => {
  it('accepts images and PDFs judged by their content, and refuses anything else', async () => {
    assert.equal((await upload(h, w.staff, 'receipt', PNG, 'receipt.png')).status, 201);
    assert.equal((await upload(h, w.staff, 'receipt', PDF, 'receipt.pdf')).status, 201);

    const disguised = await upload(h, w.staff, 'receipt', Buffer.from('<script>alert(1)</script>'), 'receipt.png');
    assert.equal(disguised.status, 400);
    assert.match(disguised.body.error, /PNG, JPEG, GIF or WebP image, or a PDF/);
  });

  it('refuses a file over 5 MB with a clear message', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(h, w.staff, 'receipt', big, 'big.png');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /larger than 5 MB/);
  });

  it('lets only an admin upload a logo, chop or signature, and only as PNG or JPEG', async () => {
    assert.equal((await upload(h, w.bookkeeper, 'branding')).status, 403);
    assert.equal((await upload(h, w.admin, 'branding', PDF, 'chop.pdf')).status, 400);
    assert.equal((await upload(h, w.admin, 'branding')).status, 201);
  });

  it('shows a receipt to its uploader and the office, and to no other staff member', async () => {
    const file = (await upload(h, w.staff, 'receipt')).body;
    const other = await h.user('staff', 'Other Staff');

    const own = await h.as(w.staff).get(`/files/${file.id}`);
    assert.equal(own.status, 200);
    assert.equal(own.headers['content-type'], 'image/png');
    assert.equal(own.headers['x-content-type-options'], 'nosniff');
    assert.equal((await h.as(w.bookkeeper).get(`/files/${file.id}`)).status, 200);
    assert.equal((await h.as(other).get(`/files/${file.id}`)).status, 404);
    assert.equal((await h.as(null).get(`/files/${file.id}`)).status, 401);
  });

  it('keeps the chop and signature away from staff', async () => {
    const chop = (await upload(h, w.admin, 'branding')).body;
    const saved = await h.as(w.admin).put(`/companies/${w.company.id}`, { ...w.company, chopFileId: chop.id });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.chopFileId, chop.id);

    assert.equal((await h.as(w.bookkeeper).get(`/files/${chop.id}`)).status, 200);
    assert.equal((await h.as(w.staff).get(`/files/${chop.id}`)).status, 404);
    assert.equal((await h.as(w.staff).get('/companies')).body[0].chopFileId, null);
  });

  it('does not let a receipt be used as a company chop', async () => {
    const receipt = (await upload(h, w.admin, 'receipt')).body;
    const res = await h.as(w.admin).put(`/companies/${w.company.id}`, { ...w.company, chopFileId: receipt.id });
    assert.equal(res.status, 400);
    assert.ok(res.body.fields.chopFileId);
  });
});
