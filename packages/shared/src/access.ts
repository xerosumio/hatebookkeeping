export const USER_PAGE_IDS = [
  'dashboard',
  'clients',
  'quotations',
  'invoices',
  'receipts',
  'transactions',
  'payees',
  'payment-requests',
  'reimbursements',
  'recurring',
  'shareholders',
  'funds',
  'reports',
] as const;

export type UserPageId = (typeof USER_PAGE_IDS)[number];

export const USER_PAGE_LABELS: Record<UserPageId, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  quotations: 'Quotations',
  invoices: 'Invoices',
  receipts: 'Receipts',
  transactions: 'Transactions',
  payees: 'Payees',
  'payment-requests': 'Expense Approvals',
  reimbursements: 'Reimbursements',
  recurring: 'Recurring',
  shareholders: 'Shareholders',
  funds: 'Funds',
  reports: 'Reports',
};

export interface UserAccess {
  pages: UserPageId[];
  seeAllReimbursements: boolean;
  approve: boolean;
  adjustFund: boolean;
  isRequiredApprover: boolean;
}
