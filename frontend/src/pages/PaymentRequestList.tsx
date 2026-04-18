import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  usePaymentRequests,
  useApprovePaymentRequest,
  useRejectPaymentRequest,
  useExecutePaymentRequest,
} from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../utils/money';
import { Plus } from 'lucide-react';
import type { User } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
};

export default function PaymentRequestList() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const { data: requests, isLoading } = usePaymentRequests(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const approve = useApprovePaymentRequest();
  const reject = useRejectPaymentRequest();
  const execute = useExecutePaymentRequest();

  const canCreate = user?.role === 'admin' || user?.role === 'maker';
  const canApprove = user?.role === 'admin' || user?.role === 'checker';
  const canExecute = user?.role === 'admin' || user?.role === 'maker';

  async function handleReject(id: string) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await reject.mutateAsync({ id, reason });
  }

  async function handleExecute(id: string) {
    const bankReference = prompt('Bank reference (optional):') || '';
    await execute.mutateAsync({ id, bankReference });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payment Requests</h1>
        {canCreate && (
          <Link
            to="/payment-requests/new"
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Request
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-4">
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created By</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const creator = typeof r.createdBy === 'object' ? (r.createdBy as User) : null;
                const isOwnRequest = creator?.id === user?.id;

                return (
                  <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.requestNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{r.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{r.payee}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.description}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatMoney(r.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{creator?.name || ''}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {r.status === 'pending' && canApprove && !isOwnRequest && (
                          <>
                            <button
                              onClick={() => approve.mutateAsync(r._id)}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(r._id)}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && canExecute && (
                          <button
                            onClick={() => handleExecute(r._id)}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            Mark Executed
                          </button>
                        )}
                      </div>
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
