import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  usePaymentRequest,
  useApprovePaymentRequest,
  useRejectPaymentRequest,
  useExecutePaymentRequest,
  useDeletePaymentRequest,
  useNotifyPaymentRequest,
  useUsers,
} from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../utils/money';
import { Paperclip, Pencil, Trash2, Plus, CheckCircle, XCircle, Zap, Clock, Send, Mail } from 'lucide-react';
import type { User, Payee, ActivityLogEntry, Entity } from '../types';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  executed: 'bg-green-100 text-green-700',
};


const actionConfig: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  created: { label: 'Created', icon: Plus, color: 'text-blue-500' },
  updated: { label: 'Updated', icon: Pencil, color: 'text-gray-500' },
  notified: { label: 'Notification Sent', icon: Mail, color: 'text-indigo-500' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600' },
  executed: { label: 'Executed', icon: Zap, color: 'text-purple-600' },
};

export default function PaymentRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pr, isLoading } = usePaymentRequest(id || '');
  const approve = useApprovePaymentRequest();
  const reject = useRejectPaymentRequest();
  const execute = useExecutePaymentRequest();
  const deletePr = useDeletePaymentRequest();
  const notify = useNotifyPaymentRequest();
  const { data: allUsers } = useUsers();

  const [bankRef, setBankRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showExecute, setShowExecute] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!pr) return <p className="text-gray-500">Payment request not found.</p>;

  const creator = typeof pr.createdBy === 'object' ? (pr.createdBy as User) : null;
  const isOwnRequest = creator && user && (creator as any)._id === user.id;
  const canApprove = user?.role === 'admin';
  const canExecute = user?.role === 'admin' || user?.role === 'user';
  const canEdit = pr.status !== 'executed' && (user?.role === 'admin' || user?.role === 'user');
  const canDelete = pr.status === 'pending' && (user?.role === 'admin' || isOwnRequest);
  const canNotify = pr.status === 'pending';

  const hasRecipients = pr.items.some((item) => item.recipient);

  function openNotifyModal() {
    const adminEmails = (allUsers || [])
      .filter((u) => u.role === 'admin' && u.active)
      .map((u) => u.email);
    setSelectedEmails(adminEmails);
    setShowNotify(true);
  }

  function toggleEmail(email: string, isAdmin: boolean) {
    if (isAdmin) return;
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  async function handleNotify() {
    if (!id || selectedEmails.length === 0) return;
    await notify.mutateAsync({ id, emails: selectedEmails });
    setShowNotify(false);
  }

  async function handleApprove() {
    if (!id) return;
    await approve.mutateAsync(id);
  }

  async function handleReject() {
    if (!id || !rejectReason.trim()) return;
    await reject.mutateAsync({ id, reason: rejectReason });
    setShowReject(false);
  }

  async function handleExecute() {
    if (!id) return;
    await execute.mutateAsync({ id, bankReference: bankRef });
    setShowExecute(false);
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this payment request? This cannot be undone.')) return;
    await deletePr.mutateAsync(id);
    navigate('/payment-requests');
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{pr.requestNumber}</h1>
          {pr.description && <p className="text-gray-500 mt-1">{pr.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[pr.status]}`}>
            {pr.status}
          </span>
          {canNotify && (
            <button
              onClick={openNotifyModal}
              className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
            >
              <Send size={14} /> Send for Approval
            </button>
          )}
          {canEdit && (
            <Link to={`/payment-requests/${id}/edit`} className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
              <Pencil size={14} /> Edit
            </Link>
          )}
          {canDelete && (
            <button onClick={handleDelete} disabled={deletePr.isPending} className="flex items-center gap-1 border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={14} /> Delete
            </button>
          )}
          <Link to="/payment-requests" className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50">
            Back to List
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="grid grid-cols-4 gap-6 text-sm">
            {pr.entity && typeof pr.entity === 'object' && (
              <div>
                <p className="text-xs text-gray-500">Entity</p>
                <p className="font-medium">{(pr.entity as Entity).code} — {(pr.entity as Entity).name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Created By</p>
              <p className="font-medium">{creator?.name || '—'}</p>
              <p className="text-xs text-gray-400">{new Date(pr.createdAt).toLocaleDateString()}</p>
            </div>
            {pr.sourceBankAccount && (
              <div>
                <p className="text-xs text-gray-500">Source Bank Account</p>
                <p className="font-medium">{pr.sourceBankAccount}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="text-lg font-bold tabular-nums">{formatMoney(pr.totalAmount)}</p>
            </div>
          </div>
          {pr.notifiedEmails && pr.notifiedEmails.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Notified</p>
              <div className="flex flex-wrap gap-1">
                {pr.notifiedEmails.map((email) => (
                  <span key={email} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs">
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bank Details</th>
                {hasRecipients && <th className="text-left px-4 py-3 font-medium text-gray-600">Recipient</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pr.items.map((item, i) => {
                const payee = typeof item.payee === 'object' ? (item.payee as Payee) : null;
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{payee?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {payee?.bankName && <span>{payee.bankName}</span>}
                      {payee?.bankAccountNumber && <span className="ml-1">({payee.bankAccountNumber})</span>}
                    </td>
                    {hasRecipients && (
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.recipient || <span className="text-gray-300">Direct</span>}</td>
                    )}
                    <td className="px-4 py-3 text-gray-600">{item.description}</td>
                    <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(item.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={hasRecipients ? 6 : 5} className="px-4 py-3 text-right font-medium">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">{formatMoney(pr.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {pr.attachments?.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Paperclip size={14} /> Attachments
            </h3>
            <div className="flex flex-wrap gap-2">
              {pr.attachments.map((url, i) => (
                <a key={i} href={url.startsWith('http') ? url : `${apiUrl}${url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline bg-blue-50 px-3 py-1 rounded">
                  File {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {pr.status === 'pending' && canApprove && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Review</h3>
            {showReject ? (
              <div className="space-y-2">
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason..." rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleReject} disabled={!rejectReason.trim() || reject.isPending} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                    {reject.isPending ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                  <button onClick={() => setShowReject(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleApprove} disabled={approve.isPending} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                  {approve.isPending ? 'Approving...' : 'Approve'}
                </button>
                <button onClick={() => setShowReject(true)} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700">
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {pr.status === 'approved' && canExecute && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Mark as Executed</h3>
            {showExecute ? (
              <div className="space-y-2">
                <input type="text" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="Bank reference (optional)" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleExecute} disabled={execute.isPending} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {execute.isPending ? 'Executing...' : 'Confirm Executed'}
                  </button>
                  <button onClick={() => setShowExecute(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowExecute(true)} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                Mark as Executed
              </button>
            )}
          </div>
        )}

        {/* Activity History */}
        {pr.activityLog && pr.activityLog.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-1">
              <Clock size={14} /> History
            </h3>
            <div className="space-y-0">
              {pr.activityLog.map((entry: ActivityLogEntry, i: number) => {
                const cfg = actionConfig[entry.action] || actionConfig.created;
                const Icon = cfg.icon;
                const userName = typeof entry.user === 'object' ? entry.user.name : 'Unknown';
                const isLast = i === pr.activityLog!.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 ${cfg.color}`}>
                        <Icon size={14} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm">
                        <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                        {' by '}
                        <span className="font-medium">{userName}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</p>
                      {entry.note && <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Send for Approval Modal */}
      {showNotify && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Send for Approval</h3>
              <p className="text-sm text-gray-500 mt-1">Select who should receive this payment request by email. Admins are always notified.</p>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto">
              {(allUsers || [])
                .filter((u) => u.active)
                .map((u) => {
                  const isAdmin = u.role === 'admin';
                  const checked = selectedEmails.includes(u.email);
                  return (
                    <label
                      key={u._id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer hover:bg-gray-50 ${isAdmin ? 'opacity-90' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmail(u.email, isAdmin)}
                        disabled={isAdmin}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </label>
                  );
                })}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-400">{selectedEmails.length} recipient(s)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNotify(false)}
                  className="px-4 py-1.5 rounded text-sm text-gray-600 border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNotify}
                  disabled={selectedEmails.length === 0 || notify.isPending}
                  className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send size={14} />
                  {notify.isPending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
