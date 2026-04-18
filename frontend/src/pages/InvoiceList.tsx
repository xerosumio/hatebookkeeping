import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvoices } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Plus } from 'lucide-react';
import type { Client } from '../types';

const statusColors: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceList() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: invoices, isLoading } = useInvoices(
    statusFilter ? { status: statusFilter } : undefined,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link
          to="/invoices/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> New Invoice
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'unpaid', 'partial', 'paid'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !invoices?.length ? (
        <p className="text-gray-500">No invoices found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Milestone</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv._id}`} className="text-blue-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {typeof inv.client === 'object' ? (inv.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{inv.milestone}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(inv.total)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(inv.amountDue)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
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
