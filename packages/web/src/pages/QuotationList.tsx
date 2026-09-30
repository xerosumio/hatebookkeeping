import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuotations, useEntities } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Plus } from 'lucide-react';
import type { Client, Entity } from '../types';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-indigo-100 text-indigo-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

export default function QuotationList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();
  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (entityFilter) filters.entity = entityFilter;
  const { data: quotations, isLoading } = useQuotations(
    Object.keys(filters).length ? filters : undefined,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <Link
          to="/quotations/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> New Quotation
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['', 'draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {statusLabels[s] || s || 'All'}
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
      ) : !quotations?.length ? (
        <p className="text-gray-500">No quotations found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/quotations/${q._id}`} className="text-blue-600 hover:underline">
                      {q.quotationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{q.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {typeof q.client === 'object' ? (q.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {typeof q.entity === 'object' ? (q.entity as Entity).code : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(q.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[q.status]}`}>
                      {statusLabels[q.status] || q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(q.createdAt).toLocaleDateString()}
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
