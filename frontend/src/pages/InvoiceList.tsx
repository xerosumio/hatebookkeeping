import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvoices, useEntities, useUpdateInvoiceStatus } from '../api/hooks';
import { formatMoney, titleCase } from '../utils/money';
import { Plus } from 'lucide-react';
import type { Client, Entity } from '../types';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();
  const updateStatus = useUpdateInvoiceStatus();
  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (entityFilter) filters.entity = entityFilter;
  const { data: invoices, isLoading } = useInvoices(
    Object.keys(filters).length ? filters : undefined,
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

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['', 'unpaid', 'partial', 'paid', 'sent'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s ? titleCase(s) : 'All'}
            </button>
          ))}
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Entities</option>
          {entities?.map((ent) => (
            <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
          ))}
        </select>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
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
                    {inv.client && typeof inv.client === 'object' ? (inv.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {inv.entity && typeof inv.entity === 'object' ? (inv.entity as Entity).code : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{inv.milestone}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(inv.total)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(inv.amountDue)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={inv.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.preventDefault();
                        updateStatus.mutate({ id: inv._id, data: { status: e.target.value } });
                      }}
                      className={`appearance-none px-2 py-0.5 pr-5 rounded text-xs font-medium border-0 cursor-pointer bg-[length:12px_12px] bg-[right_4px_center] bg-no-repeat ${statusColors[inv.status] || 'bg-gray-100 text-gray-700'}`}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>
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
