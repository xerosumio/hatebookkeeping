import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Stat, Head, Chip } from '@naton/ui';
import { useCashFlow, useAccountsReceivable, useRecurringOverview, usePaymentRequests } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney, centsToDecimal, titleCase } from '../utils/money';
import type { Client } from '../types';

const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const statusColors: Record<string, 'signal' | 'human'> = {
  pending: 'signal',
  approved: 'human',
};

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const { data: cashFlow } = useCashFlow(year);
  const { data: ar } = useAccountsReceivable();
  const { data: recurring } = useRecurringOverview();
  const { data: pendingRequests } = usePaymentRequests({ status: 'pending' });
  const { data: approvedRequests } = usePaymentRequests({ status: 'approved' });
  const { user } = useAuth();

  const chartData = cashFlow?.months?.map((m: any) => ({
    name: monthNames[m.month],
    Income: centsToDecimal(m.income),
    Expense: centsToDecimal(m.expense),
  })) || [];

  const canApprove = !!user?.access?.approve;
  const canExecute = user?.role === 'admin' || user?.role === 'user';

  const actionableItems = [
    ...(canApprove
      ? (pendingRequests || []).map((r) => ({ ...r, actionType: 'Review' as const }))
      : []),
    ...(canExecute
      ? (approvedRequests || []).map((r) => ({ ...r, actionType: 'Execute' as const }))
      : []),
  ].slice(0, 8);

  const totalPendingCount = (pendingRequests?.length || 0) + (approvedRequests?.length || 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal text-ink">Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[9px] tracked text-ink-ghost">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-sm border border-hair bg-panel px-3 py-1.5 font-mono text-[10px] text-ink-dim"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        <Stat
          n={cashFlow ? formatMoney(cashFlow.totals.net) : '—'}
          label="Net income"
          ink={(cashFlow?.totals?.net ?? 0) >= 0 ? 'var(--color-authored)' : 'var(--color-breach)'}
          sub={cashFlow ? `Cash net ${formatMoney(cashFlow.totals.cashNet ?? 0)}` : undefined}
        />
        <Stat
          n={ar ? formatMoney(ar.summary.totalDue) : '—'}
          label="Accounts receivable"
          ink="var(--color-signal)"
          sub={`${ar?.summary.count || 0} invoices outstanding`}
        />
        <Stat
          n={recurring ? formatMoney(recurring.summary.monthlyNet) : '—'}
          label="Monthly recurring net"
          ink={(recurring?.summary?.monthlyNet ?? 0) >= 0 ? 'var(--color-authored)' : 'var(--color-breach)'}
        />
        <Stat
          n={totalPendingCount}
          label="Pending actions"
          sub={totalPendingCount > 0 ? 'View payment requests' : undefined}
        />
      </div>

      <div className="mb-8 rounded-md border border-hair bg-panel p-4 lift">
        <Head right={String(year)}>Income & expense</Head>
        <p className="mb-4 font-mono text-[9px] text-ink-ghost">P&amp;L by accounting date. Currency conversion excluded.</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => `HK$ ${Number(value).toLocaleString('en-HK', { minimumFractionDigits: 2 })}`} />
            <Legend />
            <Bar dataKey="Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Expense" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {actionableItems.length > 0 && (
        <div className="mb-8 rounded-md border border-hair bg-panel p-4 lift">
          <div className="mb-3 flex items-center justify-between">
            <Head>Payment requests requiring action</Head>
            <Link to="/payment-requests" className="font-mono text-[9px] text-human hover:underline">View all</Link>
          </div>
          <table className="w-full font-mono text-[10px]">
            <thead className="border-b border-hair">
              <tr>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Number</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Description</th>
                <th className="px-4 py-3 text-right font-medium tracked text-ink-ghost">Total</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Status</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Action</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Date</th>
              </tr>
            </thead>
            <tbody>
              {actionableItems.map((r) => (
                <tr key={r._id} className="border-b border-hair/60">
                  <td className="px-4 py-3">
                    <Link to={`/payment-requests/${r._id}`} className="font-medium text-human hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-ink-dim">{r.description || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={statusColors[r.status] ?? 'neutral'}>{titleCase(r.status)}</Chip>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/payment-requests/${r._id}`}>
                      <Chip tone="human">{r.actionType}</Chip>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[9px] text-ink-ghost">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ar && ar.invoices.length > 0 && (
        <div className="rounded-md border border-hair bg-panel p-4 lift">
          <Head>Outstanding invoices</Head>
          <table className="mt-3 w-full font-mono text-[10px]">
            <thead className="border-b border-hair">
              <tr>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Invoice</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Client</th>
                <th className="px-4 py-3 text-right font-medium tracked text-ink-ghost">Due</th>
                <th className="px-4 py-3 text-left font-medium tracked text-ink-ghost">Status</th>
              </tr>
            </thead>
            <tbody>
              {ar.invoices.slice(0, 10).map((inv: any) => (
                <tr key={inv._id} className="border-b border-hair/60">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv._id}`} className="text-human hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-dim">
                    {typeof inv.client === 'object' ? (inv.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-breach">{formatMoney(inv.amountDue)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={inv.status === 'partial' ? 'signal' : 'breach'}>{titleCase(inv.status)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
