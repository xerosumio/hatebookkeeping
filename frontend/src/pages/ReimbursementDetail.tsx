import { Link, useParams, useNavigate } from 'react-router-dom';
import { useReimbursement, useDeleteReimbursement } from '../api/hooks';
import { formatMoney, titleCase } from '../utils/money';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { PaymentRequest } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
};

export default function ReimbursementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: reimbursement, isLoading } = useReimbursement(id || '');
  const deleteReimbursement = useDeleteReimbursement();

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!reimbursement) return <p className="text-gray-500">Reimbursement not found.</p>;

  const pr = reimbursement.paymentRequest as PaymentRequest | undefined;
  const prStatus = pr?.status || 'pending';
  const canEdit = prStatus === 'pending';
  const submitter = typeof reimbursement.submittedBy === 'object' ? reimbursement.submittedBy : null;
  const apiUrl = import.meta.env.VITE_API_URL || '';

  function handleDelete() {
    if (confirm(`Delete reimbursement ${reimbursement!.reimbursementNumber}? This will also delete the linked payment request.`)) {
      deleteReimbursement.mutate(reimbursement!._id, {
        onSuccess: () => navigate('/reimbursements'),
      });
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{reimbursement.reimbursementNumber}</h1>
          <p className="text-gray-500 text-sm mt-1">{reimbursement.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[prStatus]}`}>
            {titleCase(prStatus)}
          </span>
          {canEdit && (
            <>
              <Link
                to={`/reimbursements/${reimbursement._id}/edit`}
                className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                <Pencil size={14} /> Edit
              </Link>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Claim Details</h3>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Submitted By</span>
              <span>{submitter?.name || ''}</span>
            </div>
            {submitter?.fpsPhone && (
              <div className="flex justify-between">
                <span className="text-gray-500">FPS</span>
                <span>{submitter.fpsPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Bank Details</span>
              <span>
                {submitter?.bankName
                  ? `${submitter.bankName} ${submitter.bankAccountNumber || ''}`
                  : !submitter?.fpsPhone ? <span className="text-gray-300 text-xs">Not configured</span> : <span className="text-gray-300 text-xs">N/A</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{new Date(reimbursement.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-mono font-bold">{formatMoney(reimbursement.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Linked Payment Request</h3>
          {pr ? (
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Number</span>
                <Link to={`/payment-requests/${pr._id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                  {pr.requestNumber} <ExternalLink size={12} />
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[pr.status]}`}>{titleCase(pr.status)}</span>
              </div>
              {pr.approvedBy && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Approved By</span>
                  <span>{typeof pr.approvedBy === 'object' ? (pr.approvedBy as any).name : ''}</span>
                </div>
              )}
              {pr.bankReference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank Reference</span>
                  <span className="font-mono text-xs">{pr.bankReference}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No linked payment request.</p>
          )}
        </div>
      </div>

      {reimbursement.notes && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{reimbursement.notes}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
            </tr>
          </thead>
          <tbody>
            {reimbursement.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-gray-500">{item.category}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(item.amount)}</td>
                <td className="px-4 py-3">
                  {item.receiptUrl ? (
                    <a
                      href={item.receiptUrl.startsWith('http') ? item.receiptUrl : `${apiUrl}${item.receiptUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-gray-300 text-xs">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.notes || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 font-medium text-right">Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{formatMoney(reimbursement.totalAmount)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
