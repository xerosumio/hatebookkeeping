import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaymentRequests, useDeletePaymentRequest, useEntities } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../utils/money';
import { Plus, Trash2 } from 'lucide-react';
import type { User, Entity } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
};

export default function PaymentRequestList() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();
  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (entityFilter) filters.entity = entityFilter;
  const { data: requests, isLoading } = usePaymentRequests(
    Object.keys(filters).length ? filters : undefined,
  );
  const deleteMutation = useDeletePaymentRequest();

  const canCreate = user?.role === 'admin' || user?.role === 'user';
  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expense Approvals</h1>
        {canCreate && (
          <Link
            to="/payment-requests/new"
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Request
          </Link>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected', 'executed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
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
      ) : !requests?.length ? (
        <p className="text-gray-500">No payment requests.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const creator = typeof r.createdBy === 'object' ? (r.createdBy as User) : null;
                return (
                  <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/payment-requests/${r._id}`} className="text-blue-600 hover:underline font-medium">
                        {r.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.entity && typeof r.entity === 'object' ? (r.entity as Entity).code : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.description || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(r.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{creator?.name || ''}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {isAdmin && r.status !== 'executed' && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete request ${r.requestNumber}?`)) {
                              deleteMutation.mutate(r._id);
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
