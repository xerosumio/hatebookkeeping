import request from 'supertest';
import type { CategoryDto, CompanyDto } from '@hbk/shared';
import type { Harness, TestUser } from './harness.js';

/** The smallest valid PNG: enough for the upload check and for a PDF to embed. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

export function upload(h: Harness, user: TestUser, purpose: 'branding' | 'receipt', data: Buffer = PNG, filename = 'file.png') {
  return request(h.app)
    .post('/api/files')
    .set('Authorization', `Bearer ${user.token}`)
    .field('purpose', purpose)
    .attach('file', data, filename);
}

export interface World {
  admin: TestUser;
  /** A bookkeeper who is an approver. */
  bookkeeper: TestUser;
  /** A second approver, so that someone other than the author can approve. */
  approver: TestUser;
  staff: TestUser;
  company: CompanyDto;
  categories: CategoryDto[];
  /** The id of an active, non-system category of this type. */
  category(type: 'income' | 'expense', name?: string): string;
}

/** A set-up office: one company, an admin, two approvers (one approval needed) and a staff member. */
export async function world(h: Harness): Promise<World> {
  const admin = await h.user('admin', 'Ada Admin');
  const bookkeeper = await h.user('bookkeeper', 'Bo Bookkeeper');
  const approver = await h.user('bookkeeper', 'Cy Approver');
  const staff = await h.user('staff', 'Sia Staff');

  const company = await h.as(admin).post('/companies', {
    code: 'AX',
    name: 'Axilogy Limited',
    address: '1 Test Road, Hong Kong',
    bankDetails: 'Bank: Test Bank\nAccount: 123-456-789',
    quoteTerms: 'Valid for 30 days.',
  });
  if (company.status !== 201) throw new Error(`company: ${JSON.stringify(company.body)}`);

  const approval = await h.as(admin).put('/settings/approval', { approverIds: [bookkeeper.id, approver.id], approvalsRequired: 1 });
  if (approval.status !== 200) throw new Error(`approval: ${JSON.stringify(approval.body)}`);

  const categories = (await h.as(admin).get('/settings/categories')).body as CategoryDto[];
  return {
    admin,
    bookkeeper,
    approver,
    staff,
    company: company.body as CompanyDto,
    categories,
    category(type, name) {
      const found = categories.find((category) => category.type === type && !category.system && (!name || category.name === name));
      if (!found) throw new Error(`no ${type} category ${name ?? ''}`);
      return found.id;
    },
  };
}
