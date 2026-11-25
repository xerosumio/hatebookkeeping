import type { Permission } from '@hbk/shared';

export interface NavItem {
  to: string;
  label: string;
  /** Shown when the person holds any of these. */
  needs: Permission[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', needs: ['dashboard.view'] },
      { to: '/pnl', label: 'Profit & loss', needs: ['pnl.view'] },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/quotes', label: 'Quotes', needs: ['quotes.view'] },
      { to: '/invoices', label: 'Invoices', needs: ['invoices.view'] },
      { to: '/clients', label: 'Clients', needs: ['clients.view'] },
      { to: '/other-income', label: 'Other income', needs: ['otherIncome.manage'] },
    ],
  },
  {
    title: 'Spending',
    items: [
      { to: '/expenses', label: 'Expenses', needs: ['expenses.view'] },
      { to: '/claims', label: 'Claims', needs: ['claims.own'] },
      { to: '/salary', label: 'Salary', needs: ['salary.view'] },
      { to: '/payees', label: 'Payees', needs: ['payees.view'] },
      { to: '/recurring', label: 'Recurring', needs: ['recurring.view'] },
    ],
  },
  {
    title: 'Setup',
    items: [
      { to: '/users', label: 'Users', needs: ['users.manage'] },
      { to: '/settings', label: 'Settings', needs: ['settings.manage'] },
    ],
  },
];
