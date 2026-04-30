import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useMonthlyClose, useSubmitMonthlyClose, useApproveMonthlyClose,
  useRejectMonthlyClose, useNotifyMonthlyClose, useFinalizeMonthlyClose,
  useCreateCollectionRequests, useUsers,
} from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../utils/money';
import { CheckCircle, XCircle, Clock, Send, FileText, Bell, AlertTriangle } from 'lucide-react';
import type { Entity, MonthlyCloseActivity } from '../types';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  pending_approval: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Approval' },
  approved: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Approved' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  finalized: { bg: 'bg-green-50', text: 'text-green-700', label: 'Finalized' },
};

const ACTIVITY_ICONS: Record<string, typeof CheckCircle> = {
  created: FileText,
  submitted: Send,
  approved: CheckCircle,
  rejected: XCircle,
  finalized: CheckCircle,
  notified: Bell,
};

const ACTIVITY_COLORS: Record<string, string> = {
  created: 'text-gray-500',
  submitted: 'text-blue-500',
  approved: 'text-green-500',
  rejected: 'text-red-500',
  finalized: 'text-green-600',
  notified: 'text-purple-500',
};

export default function MonthlyCloseDetail() {
  const { entity: entityId, year: yearStr, month: monthStr } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const year = parseInt(yearStr || '0');
  const month = parseInt(monthStr || '0');

  const { data, isLoading, refetch } = useMonthlyClose(entityId || '', year, month);
  const { data: users } = useUsers();
  const submitMutation = useSubmitMonthlyClose();
  const approveMutation = useApproveMonthlyClose();
  const rejectMutation = useRejectMonthlyClose();
  const notifyMutation = useNotifyMonthlyClose();
  const finalizeMutation = useFinalizeMonthlyClose();
  const collectionMutation = useCreateCollectionRequests();

  const [notes, setNotes] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-gray-500">No data</p>;

  const status = data.status;
  const isAdmin = user?.role === 'admin';
  const entityName = data.entity && typeof data.entity === 'object' ? (data.entity as Entity).name : '';
  const entityCode = data.entity && typeof data.entity === 'object' ? (data.entity as Entity).code : '';
  const badge = STATUS_BADGES[status] || STATUS_BADGES.draft;

  const myApproval = (data.approvals || []).some(
    (a) => (typeof a.user === 'object' ? a.user._id : a.user) === user?.id,
  );

  async function handleSubmit() {
    if (!entityId) return;
    await submitMutation.mutateAsync({ entity: entityId, year, month, notes });
    setShowSubmitModal(false);
    refetch();
  }

  async function handleApprove() {
    if (!entityId) return;
    await approveMutation.mutateAsync({ entity: entityId, year, month });
    refetch();
  }

  async function handleReject() {
    if (!entityId || !rejectReason.trim()) return;
    await rejectMutation.mutateAsync({ entity: entityId, year, month, reason: rejectReason });
    setShowRejectModal(false);
    setRejectReason('');
    refetch();
  }

  async function handleNotify() {
    if (!entityId || selectedEmails.size === 0) return;
    await notifyMutation.mutateAsync({ entity: entityId, year, month, emails: [...selectedEmails] });
    setShowNotifyModal(false);
    setSelectedEmails(new Set());
    refetch();
  }

  async function handleFinalize() {
    if (!entityId) return;
    await finalizeMutation.mutateAsync({ entity: entityId, year, month, notes });
    setShowFinalizeModal(false);
    refetch();
  }

  async function handleCreateCollections() {
    if (!entityId) return;
    await collectionMutation.mutateAsync({ entity: entityId, year, month });
    setShowCollectionModal(false);
    refetch();
  }

  return (
    <div className="max-w-5xl">
      <button onClick={() => navigate('/monthly-close')} className="text-sm text-blue-600 hover:underline mb-4">
        &larr; Back to Monthly Close
      </button>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{MONTH_NAMES[month]} {year}</h1>
          {entityCode && <span className="text-sm text-gray-500 mr-2">{entityCode} -- {entityName}</span>}
          <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'pending_approval' && (
            <button
              onClick={() => {
                const adminEmails = (users || []).filter((u: any) => u.role === 'admin' && u.email).map((u: any) => u.email);
                setSelectedEmails(new Set(adminEmails));
                setShowNotifyModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              <Bell size={14} /> Send for Approval
            </button>
          )}
        </div>
      </div>

      {/* Rejection reason */}
      {status === 'rejected' && data.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-sm font-medium text-red-800 mb-1">Rejected</div>
          <p className="text-sm text-red-700">{data.rejectionReason}</p>
        </div>
      )}

      {/* Cash position cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Opening Cash</div>
          <div className="text-lg font-bold font-mono">{formatMoney(data.openingCash)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Income</div>
          <div className="text-lg font-bold font-mono text-green-600">+{formatMoney(data.totalIncome)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Expenses</div>
          <div className="text-lg font-bold font-mono text-red-600">-{formatMoney(data.totalExpense)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Net P&L</div>
          <div className={`text-lg font-bold font-mono ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(data.netProfit)}
          </div>
        </div>
        <div className={`border rounded-lg p-4 ${data.availableCash >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-xs text-gray-600">Available Cash</div>
          <div className={`text-lg font-bold font-mono ${data.availableCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatMoney(data.availableCash)}
          </div>
        </div>
      </div>

      {/* Action badge */}
      <div className={`rounded-lg p-4 mb-6 ${data.isLoss ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-center gap-2">
          {data.isLoss ? (
            <>
              <AlertTriangle size={18} className="text-red-600" />
              <span className="text-sm font-semibold text-red-800">Investors Need to Inject Funds</span>
            </>
          ) : (
            <>
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-sm font-semibold text-green-800">Ready to Distribute</span>
            </>
          )}
        </div>
      </div>

      {/* Distribution split (profit only) */}
      {!data.isLoss && data.availableCash > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs text-blue-600">Shareholder Distribution (75%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.shareholderDistribution)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-xs text-purple-600">Company Reserve (20%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.companyReserve)}</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="text-xs text-teal-600">Staff Reserve (5%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.staffReserve)}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-xs text-gray-500">Closing Cash (next month opening)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.closingCash)}</div>
          </div>
        </div>
      )}

      {/* Shareholder table */}
      <h2 className="text-lg font-semibold mb-3">
        {data.isLoss ? 'Collection from Shareholders' : 'Distribution to Shareholders'}
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Shareholder</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Share %</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.distributions.map((d, i) => {
              const name = typeof d.shareholder === 'object' ? d.shareholder.name : d.shareholder;
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3 text-right font-mono">{d.sharePercent.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-right font-mono ${data.isLoss ? 'text-red-600' : 'text-green-600'}`}>
                    {data.isLoss ? '-' : ''}{formatMoney(Math.abs(d.amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dual approval status */}
      {status === 'pending_approval' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3">Approval Status</h3>
          <p className="text-xs text-gray-500 mb-3">Requires approval from both William and Andy</p>
          <div className="flex gap-4 mb-4">
            {(data.approvals || []).map((a, i) => {
              const name = typeof a.user === 'object' ? a.user.name : a.user;
              return (
                <div key={i} className="flex items-center gap-1.5 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="font-medium">{name}</span>
                  <span className="text-xs text-gray-400">{new Date(a.at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          {isAdmin && !myApproval && (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          )}
          {isAdmin && myApproval && (
            <p className="text-xs text-green-600">You have already approved this close.</p>
          )}
        </div>
      )}

      {/* Submit for approval (draft / rejected) */}
      {(status === 'draft' || status === 'rejected') && isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Any notes about this month's close..."
            />
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            Submit for Approval
          </button>
        </div>
      )}

      {/* Finalize (approved only) */}
      {status === 'approved' && isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-700 mb-3">
            This close has been approved. Finalizing will create equity transactions, transfer reserves to funds, and lock the month.
          </p>
          <button
            onClick={() => setShowFinalizeModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            Finalize Month
          </button>
        </div>
      )}

      {/* Collection requests (finalized + loss) */}
      {status === 'finalized' && data.isLoss && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700 mb-3">
            This month had a net shortfall. Create payment requests to collect from shareholders.
          </p>
          <button
            onClick={() => setShowCollectionModal(true)}
            disabled={collectionMutation.isPending}
            className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            Create Collection Requests
          </button>
        </div>
      )}

      {/* Notified emails */}
      {(data.notifiedEmails || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Notified</h3>
          <div className="flex flex-wrap gap-1">
            {data.notifiedEmails.map((e, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{e}</span>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      {(data.activityLog || []).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Activity</h3>
          <div className="space-y-3">
            {data.activityLog.map((entry: MonthlyCloseActivity, i: number) => {
              const Icon = ACTIVITY_ICONS[entry.action] || FileText;
              const color = ACTIVITY_COLORS[entry.action] || 'text-gray-400';
              const userName = typeof entry.user === 'object' ? entry.user.name : entry.user;
              return (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <Icon size={16} className={`mt-0.5 ${color}`} />
                  <div>
                    <span className="font-medium capitalize">{entry.action}</span>
                    <span className="text-gray-500"> by {userName}</span>
                    <span className="text-gray-400 text-xs ml-2">{new Date(entry.timestamp).toLocaleString()}</span>
                    {entry.note && <p className="text-gray-500 text-xs mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed by footer */}
      {status === 'finalized' && data.closedBy && (
        <div className="text-xs text-gray-400">
          Finalized by {typeof data.closedBy === 'object' ? data.closedBy.name : data.closedBy}
          {data.closedAt && ` on ${new Date(data.closedAt).toLocaleString()}`}
          {data.notes && ` -- ${data.notes}`}
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────── */}

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Submit for Approval</h3>
            <p className="text-sm text-gray-600 mb-4">
              Submit {MONTH_NAMES[month]} {year} close for {entityName || entityCode} for dual approval?
              This will lock the figures and require approval from both William and Andy.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Reject Monthly Close</h3>
            <p className="text-sm text-gray-600 mb-3">
              Provide a reason for rejecting {MONTH_NAMES[month]} {year}:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Send for Approval</h3>
            <p className="text-sm text-gray-600 mb-3">Select recipients to notify:</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {(users || []).filter((u: any) => u.active !== false && u.email).map((u: any) => (
                <label key={u._id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(u.email)}
                    disabled={u.role === 'admin'}
                    onChange={(e) => {
                      const next = new Set(selectedEmails);
                      if (e.target.checked) next.add(u.email);
                      else next.delete(u.email);
                      setSelectedEmails(next);
                    }}
                    className="rounded"
                  />
                  <span>{u.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {u.role}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNotifyModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleNotify}
                disabled={notifyMutation.isPending || selectedEmails.size === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {notifyMutation.isPending ? 'Sending...' : `Send (${selectedEmails.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[480px]">
            <h3 className="text-lg font-semibold mb-2">Finalize {MONTH_NAMES[month]} {year}</h3>
            <p className="text-sm text-gray-600 mb-4">This action will:</p>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>- Create equity transactions for all shareholders</li>
              {!data.isLoss && <li>- Transfer {formatMoney(data.companyReserve)} to Company Reserve fund</li>}
              {!data.isLoss && <li>- Transfer {formatMoney(data.staffReserve)} to Staff Reserve fund</li>}
              <li>- Lock this month (cannot be undone)</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFinalizeModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection requests modal */}
      {showCollectionModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Create Collection Requests</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create payment requests to collect {formatMoney(Math.abs(data.availableCash))} from shareholders based on their share percentages.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCollectionModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleCreateCollections}
                disabled={collectionMutation.isPending}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {collectionMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
