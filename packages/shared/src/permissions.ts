/**
 * The one table that says who may do what. The server enforces it on every
 * request and the web app reads the same table to show or hide controls.
 *
 * Approving is not in this table: approvers are named people chosen in
 * Settings, whatever their role.
 */

export const ROLES = ['admin', 'bookkeeper', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  bookkeeper: 'Bookkeeper',
  staff: 'Staff',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Everything, including users and settings.',
  bookkeeper: 'Quotes, invoices, expenses, claims, salary and the P&L. No users or settings.',
  staff: 'Their own claims only.',
};

const everyone: readonly Role[] = ROLES;
const office: readonly Role[] = ['admin', 'bookkeeper'];
const adminOnly: readonly Role[] = ['admin'];

export const PERMISSIONS = {
  'dashboard.view': office,
  'pnl.view': office,
  'clients.view': office,
  'clients.manage': office,
  'quotes.view': office,
  'quotes.manage': office,
  'invoices.view': office,
  'invoices.manage': office,
  'payments.record': office,
  'payments.void': adminOnly,
  'payees.view': office,
  'payees.manage': office,
  'expenses.view': office,
  'expenses.manage': office,
  'expenses.pay': office,
  'expenses.reverse': adminOnly,
  'claims.own': everyone,
  'claims.viewAll': office,
  'salary.view': office,
  'salary.manage': office,
  'otherIncome.manage': office,
  'recurring.view': office,
  'recurring.manage': office,
  'companies.view': office,
  'users.manage': adminOnly,
  'settings.manage': adminOnly,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => can(role, permission));
}

/** Roles a person must hold to be chosen as an approver. */
export const APPROVER_ROLES: readonly Role[] = office;
