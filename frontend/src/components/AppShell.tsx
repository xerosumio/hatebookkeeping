import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  ArrowRightLeft,
  ClipboardCheck,
  Repeat,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/quotations', icon: FileText, label: 'Quotations' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/receipts', icon: Receipt, label: 'Receipts' },
  { to: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  { to: '/payment-requests', icon: ClipboardCheck, label: 'Approvals' },
  { to: '/recurring', icon: Repeat, label: 'Recurring' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">HateBookkeeping</h1>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-200 space-y-0.5">
          {user?.role === 'admin' && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Settings size={18} />
              Settings
            </NavLink>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <LogOut size={18} />
            Sign out
          </button>
          <div className="px-3 py-2 text-xs text-gray-400">
            {user?.name} ({user?.role})
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
