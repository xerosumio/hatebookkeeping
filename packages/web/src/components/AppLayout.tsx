import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, NavLink, Navigate, useLocation } from 'react-router-dom';
import { USER_PAGE_IDS, type UserPageId } from '@hbk/shared';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  ArrowRightLeft,
  ClipboardCheck,
  UserCheck,
  Wallet,
  Repeat,
  BarChart3,
  Settings,
  LogOut,
  UsersRound,
  PieChart,
  Landmark,
  RefreshCw,
  Plug,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { AppSwitcher } from './AppSwitcher';
import { cycleTheme, readTheme, type Theme } from '../lib/theme';

const navItems: { id: UserPageId; to: string; icon: typeof LayoutDashboard; label: string }[] = [
  { id: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'clients', to: '/clients', icon: Users, label: 'Clients' },
  { id: 'quotations', to: '/quotations', icon: FileText, label: 'Quotations' },
  { id: 'invoices', to: '/invoices', icon: FileText, label: 'Invoices' },
  { id: 'receipts', to: '/receipts', icon: Receipt, label: 'Receipts' },
  { id: 'transactions', to: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  { id: 'payees', to: '/payees', icon: UserCheck, label: 'Payees' },
  { id: 'payment-requests', to: '/payment-requests', icon: ClipboardCheck, label: 'Expense Approvals' },
  { id: 'reimbursements', to: '/reimbursements', icon: Wallet, label: 'Reimbursements' },
  { id: 'recurring', to: '/recurring', icon: Repeat, label: 'Recurring' },
  { id: 'shareholders', to: '/shareholders', icon: PieChart, label: 'Shareholders' },
  { id: 'funds', to: '/funds', icon: Landmark, label: 'Funds' },
  { id: 'reports', to: '/reports', icon: BarChart3, label: 'Reports' },
];

const ADMIN_ONLY = new Set(['users', 'settings', 'airwallex-sync', 'endpoint', 'agent-guide']);

function pageIdForPath(pathname: string): UserPageId | 'admin-only' | null {
  if (pathname === '/') return 'dashboard';
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return null;
  if (ADMIN_ONLY.has(segment)) return 'admin-only';
  if ((USER_PAGE_IDS as readonly string[]).includes(segment)) return segment as UserPageId;
  return null;
}

function pathForPage(id: UserPageId) {
  return id === 'dashboard' ? '/' : `/${id}`;
}

export default function AppLayout() {
  const { user, logout, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.title = 'HateBookkeeping';
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = (mobile: boolean) => {
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const closeOnMobile = () => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-2" style={{ width: 220 }}>
          <div className="h-3 animate-pulse rounded bg-raised" style={{ width: '70%' }} />
          <div className="h-3 animate-pulse rounded bg-raised" style={{ width: '50%' }} />
        </div>
      </div>
    );
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const isAdmin = user?.role === 'admin';
  const allowedPages = new Set<UserPageId>(
    isAdmin ? USER_PAGE_IDS : (user?.access?.pages ?? USER_PAGE_IDS),
  );
  const visibleNav = navItems.filter((item) => allowedPages.has(item.id));

  return (
    <div className="flex h-full overflow-hidden bg-void">
      {isMobile && sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={[
          'z-50 flex shrink-0 flex-col overflow-hidden transition-[width,opacity] duration-200',
          sidebarOpen ? 'opacity-100' : 'w-0 opacity-0',
          isMobile && sidebarOpen ? 'fixed inset-y-0 left-0' : 'relative',
        ].join(' ')}
        style={{
          width: sidebarOpen ? (isMobile ? 280 : 240) : 0,
          background: 'var(--color-chassis)',
          transitionTimingFunction: 'var(--ease-out-nd)',
        }}
      >
        <div className="flex h-full flex-col" style={{ width: isMobile ? 280 : 240 }}>
          <div className="group/header flex h-11 items-center justify-between px-3">
            <div className="flex min-w-0 items-center gap-1">
              <AppSwitcher />
              <div className="flex min-w-0 items-center gap-2 px-1.5 py-1 font-mono text-[11px] font-medium tracking-tight">
                <span className="truncate">HateBookkeeping</span>
              </div>
            </div>
            <button
              type="button"
              className="rounded p-1 text-ink-ghost opacity-0 transition-opacity group-hover/header:opacity-100"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pt-1">
            {visibleNav.map(({ to, icon, label }) => (
              <Item key={to} to={to} label={label} icon={icon} onNavigate={closeOnMobile} end={to === '/'} />
            ))}
          </nav>

          <div className="space-y-0.5 border-t border-hair p-2">
            {user?.role === 'admin' && (
              <>
                <Item to="/users" label="Users" icon={UsersRound} onNavigate={closeOnMobile} />
                <Item to="/settings" label="Settings" icon={Settings} onNavigate={closeOnMobile} />
                <Item to="/airwallex-sync" label="Bank Balance" icon={RefreshCw} onNavigate={closeOnMobile} />
                <Item to="/endpoint" label="Endpoint" icon={Plug} onNavigate={closeOnMobile} />
                <Item to="/agent-guide" label="Agent Guide" icon={BookOpen} onNavigate={closeOnMobile} />
              </>
            )}
            <button
              type="button"
              onClick={() => setTheme(cycleTheme(theme))}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[10px] text-ink-dim transition-colors hover:bg-raised"
              aria-label={`Theme: ${theme}`}
            >
              <ThemeIcon className="h-4 w-4" />
              <span className="capitalize">{theme} mode</span>
            </button>
            {user && (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                  style={{ background: 'var(--color-human-wash)', color: 'var(--color-human)' }}
                >
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-ink-dim" title={user.email}>
                  {user.name}
                </span>
                <button
                  type="button"
                  className="rounded p-1 text-ink-dim opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Sign out"
                  onClick={logout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {!sidebarOpen && !isMobile && (
        <div
          className="group fixed bottom-0 left-0 top-0 z-30 flex w-8 items-start pt-3 pl-1"
          onMouseEnter={() => setSidebarOpen(true)}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1 text-ink-ghost opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Open sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-end gap-2 px-3 backdrop-blur-sm"
          style={{ background: 'color-mix(in srgb, var(--color-panel) 80%, transparent)' }}
        >
          {isMobile && !sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mr-auto rounded-sm p-1.5 text-ink-dim hover:bg-raised"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {user?.role === 'admin' && <NotificationBell />}
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-void px-6 pb-6 pt-2 floor-grid">
          <PageGuard allowedPages={allowedPages} isAdmin={!!isAdmin}>
            <Outlet />
          </PageGuard>
        </main>
      </div>
    </div>
  );
}

function PageGuard({
  allowedPages,
  isAdmin,
  children,
}: {
  allowedPages: Set<UserPageId>;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  if (isAdmin) return children;
  const page = pageIdForPath(pathname);
  if (page === null || (page !== 'admin-only' && allowedPages.has(page))) return children;
  const fallback = USER_PAGE_IDS.find((id) => allowedPages.has(id));
  if (!fallback) {
    return <p className="font-mono text-[11px] text-ink-dim">You do not have access to any page. Ask an admin.</p>;
  }
  const to = pathForPage(fallback);
  if (to === pathname) return children;
  return <Navigate to={to} replace />;
}

function Item({
  to,
  label,
  icon: Icon,
  onNavigate,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  onNavigate?: () => void;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-2 rounded-sm px-2 py-1.5 font-mono text-[10px] transition-colors',
          isActive
            ? 'bg-raised font-medium text-ink'
            : 'text-ink-dim hover:bg-raised',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}
