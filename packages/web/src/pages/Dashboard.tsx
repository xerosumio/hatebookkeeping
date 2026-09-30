import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCashFlow, useAccountsReceivable, useRecurringOverview, usePaymentRequests } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney, centsToDecimal, titleCase } from '../utils/money';
import type { Client } from '../types';

const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
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

  const canApprove = user?.role === 'admin';
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Net Income ({year})</div>
          <div className={`text-xl font-bold font-mono ${(cashFlow?.totals?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {cashFlow ? formatMoney(cashFlow.totals.net) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Accounts Receivable</div>
          <div className="text-xl font-bold font-mono text-amber-600">
            {ar ? formatMoney(ar.summary.totalDue) : '—'}
          </div>
          <div className="text-xs text-gray-400">{ar?.summary.count || 0} invoices outstanding</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Monthly Recurring Net</div>
          <div className={`text-xl font-bold font-mono ${(recurring?.summary?.monthlyNet ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {recurring ? formatMoney(recurring.summary.monthlyNet) : '—'}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Pending Actions</div>
          <div className="text-xl font-bold">{totalPendingCount}</div>
          {totalPendingCount > 0 && (
            <Link to="/payment-requests" className="text-xs text-blue-600 hover:underline">View all</Link>
          )}
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
        <h2 className="text-lg font-semibold mb-4">Cash Flow — {year}</h2>
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

      {/* Actionable Payment Requests */}
      {actionableItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Payment Requests Requiring Action</h2>
            <Link to="/payment-requests" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {actionableItems.map((r) => (
                <tr key={r._id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <Link to={`/payment-requests/${r._id}`} className="text-blue-600 hover:underline font-medium">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(r.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {titleCase(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/payment-requests/${r._id}`} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100">
                      {r.actionType}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outstanding Invoices */}
      {ar && ar.invoices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold mb-3">Outstanding Invoices</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {ar.invoices.slice(0, 10).map((inv: any) => (
                <tr key={inv._id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv._id}`} className="text-blue-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {typeof inv.client === 'object' ? (inv.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(inv.amountDue)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{titleCase(inv.status)}</span>
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
