import { Link } from 'react-router-dom';
import { useReimbursements, useDeleteReimbursement } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Plus, Trash2, Eye } from 'lucide-react';
import type { Reimbursement, PaymentRequest } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
};

function getStatus(r: Reimbursement): string {
  if (!r.paymentRequest) return 'pending';
  if (typeof r.paymentRequest === 'string') return 'pending';
  return (r.paymentRequest as PaymentRequest).status || 'pending';
}

export default function ReimbursementList() {
  const { data: reimbursements, isLoading } = useReimbursements();
  const deleteReimbursement = useDeleteReimbursement();

  function handleDelete(r: Reimbursement) {
    if (confirm(`Delete reimbursement ${r.reimbursementNumber}?`)) {
      deleteReimbursement.mutate(r._id);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reimbursements</h1>
        <Link
          to="/reimbursements/new"
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> New Claim
        </Link>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !reimbursements?.length ? (
        <p className="text-gray-500">No reimbursement claims yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reimbursements.map((r) => {
                const status = getStatus(r);
                return (
                  <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{r.reimbursementNumber}</td>
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {typeof r.submittedBy === 'object' ? r.submittedBy.name : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatMoney(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link to={`/reimbursements/${r._id}`} className="text-gray-400 hover:text-blue-600 p-1">
                          <Eye size={14} />
                        </Link>
                        {status === 'pending' && (
                          <button onClick={() => handleDelete(r)} className="text-gray-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
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
