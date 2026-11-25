import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { ROLE_LABELS } from '@hbk/shared';
import { useAuth } from '../shared/auth';
import { AppSwitcher } from '../shared/components/AppSwitcher';
import { Loading } from '../shared/components/ui';
import { cycleTheme, readTheme, type Theme } from '../shared/lib/theme';
import { CompanyPicker } from '../shared/company';
import { NAV } from './nav';

const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function Layout() {
  const { me, can, signOut } = useAuth();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const ThemeIcon = THEME_ICON[theme];

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.needs.some(can)),
  })).filter((group) => group.items.length > 0);

  const sidebar = (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-hair bg-chassis">
      <div className="flex items-center gap-2 px-4 py-4">
        <AppSwitcher />
        <span className="text-sm font-semibold text-ink">HateBookkeeping</span>
      </div>
      <div className="px-3">
        <CompanyPicker />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-ghost">{group.title}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-2 py-1.5 text-sm ${isActive ? 'bg-raised font-medium text-ink' : 'text-ink-dim hover:bg-raised'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-hair px-3 py-3">
        <NavLink to="/profile" onClick={() => setOpen(false)} className="block rounded-md px-2 py-1.5 hover:bg-raised">
          <div className="truncate text-sm font-medium text-ink">{me?.name}</div>
          <div className="truncate text-xs text-ink-faint">{me ? ROLE_LABELS[me.role] : ''} · My details</div>
        </NavLink>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}. Change theme`}
            onClick={() => setTheme(cycleTheme(theme))}
            className="rounded-md p-2 text-ink-dim hover:bg-raised"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void signOut()} className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-ink-dim hover:bg-raised">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <div className="hidden md:block">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {sidebar}
          <button type="button" aria-label="Close menu" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-hair bg-chassis px-4 py-3 md:hidden">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-1 text-ink-dim">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-ink">HateBookkeeping</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense key={location.pathname} fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
