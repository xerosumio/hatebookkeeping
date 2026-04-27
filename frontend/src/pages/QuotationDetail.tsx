import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useQuotation, useUpdateQuotationStatus, useConvertQuotationToInvoices,
  useApproveQuotation, useRejectQuotation, useNotifyQuotation, useUsers,
  useInvoices, fetchPdfBlob,
} from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney, titleCase } from '../utils/money';
import { FileText, Calendar, ArrowLeft, Plus, Pencil, CheckCircle, XCircle, Send, Clock, Mail } from 'lucide-react';
import PdfInlinePreview from '../components/PdfPreviewModal';
import type { Client, QuotationActivityLog, Invoice, ApprovalEntry } from '../types';

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

const actionConfig: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  created: { label: 'Created', icon: Plus, color: 'text-blue-500' },
  updated: { label: 'Updated', icon: Pencil, color: 'text-gray-500' },
  pending_approval: { label: 'Requested Approval', icon: Send, color: 'text-amber-500' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-600' },
  rejected: { label: 'Returned to Draft', icon: XCircle, color: 'text-red-600' },
  sent: { label: 'Sent to Client', icon: Send, color: 'text-blue-600' },
  accepted: { label: 'Accepted by Client', icon: CheckCircle, color: 'text-green-600' },
  client_rejected: { label: 'Rejected by Client', icon: XCircle, color: 'text-red-600' },
  notified: { label: 'Notification Sent', icon: Mail, color: 'text-indigo-500' },
};

export default function QuotationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: q, isLoading } = useQuotation(id || '');
  const updateStatus = useUpdateQuotationStatus();
  const convertToInvoices = useConvertQuotationToInvoices();
  const approve = useApproveQuotation();
  const reject = useRejectQuotation();
  const notify = useNotifyQuotation();
  const { data: allUsers } = useUsers();
  const { data: linkedInvoices } = useInvoices(id ? { quotation: id } : undefined);

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showNotify, setShowNotify] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const showPdfPreview = useCallback(async () => {
    if (!id || !q) return;
    setPdfLoading(true);
    try {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = await fetchPdfBlob(`/quotations/${id}/pdf`);
      setPdfBlobUrl(url);
    } catch {
      alert('Failed to generate PDF. Check server logs.');
    } finally {
      setPdfLoading(false);
    }
  }, [id, q, pdfBlobUrl]);

  const hidePdfPreview = useCallback(() => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  }, [pdfBlobUrl]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!q) return <p className="text-gray-500">Quotation not found.</p>;

  const client = typeof q.client === 'object' ? (q.client as Client) : null;
  const isAdmin = user?.role === 'admin';

  async function changeStatus(status: string) {
    await updateStatus.mutateAsync({ id: id!, status });
  }

  function openNotifyModal() {
    const adminEmails = (allUsers || [])
      .filter((u) => u.role === 'admin' && u.active)
      .map((u) => u.email);
    setSelectedEmails(adminEmails);
    setShowNotify(true);
  }

  function toggleEmail(email: string, isAdminUser: boolean) {
    if (isAdminUser) return;
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
    if (!id) return;
    await reject.mutateAsync({ id, reason: rejectReason });
    setShowReject(false);
    setRejectReason('');
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{q.quotationNumber}</h1>
          <p className="text-gray-500">{q.title}</p>
        </div>
        <div className="flex items-center gap-3">
          {pdfBlobUrl ? (
            <button
              onClick={hidePdfPreview}
              className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              <ArrowLeft size={14} /> Back to Details
            </button>
          ) : (
            <button
              onClick={showPdfPreview}
              disabled={pdfLoading}
              className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText size={14} /> {pdfLoading ? 'Loading...' : 'Preview PDF'}
            </button>
          )}
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[q.status]}`}>
            {statusLabels[q.status] || q.status}
          </span>
          {q.status === 'draft' && (
            <>
              <Link
                to={`/quotations/${id}/edit`}
                className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                Edit
              </Link>
              <button
                onClick={() => changeStatus('pending_approval')}
                disabled={updateStatus.isPending}
                className="bg-amber-600 text-white px-3 py-1.5 rounded text-sm hover:bg-amber-700 disabled:opacity-50"
              >
                Request Approval
              </button>
              <button
                onClick={() => changeStatus('sent')}
                disabled={updateStatus.isPending}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Send Directly
              </button>
            </>
          )}
          {q.status === 'pending_approval' && (
            <>
              <button
                onClick={openNotifyModal}
                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
              >
                <Send size={14} /> Send for Approval
              </button>
              <button
                onClick={() => changeStatus('sent')}
                disabled={updateStatus.isPending}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Skip & Mark Sent
              </button>
            </>
          )}
          {q.status === 'approved' && (
            <button
              onClick={() => changeStatus('sent')}
              disabled={updateStatus.isPending}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Mark as Sent
            </button>
          )}
          {q.status === 'sent' && (
            <>
              <button
                onClick={() => changeStatus('accepted')}
                disabled={updateStatus.isPending}
                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => changeStatus('rejected')}
                disabled={updateStatus.isPending}
                className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {q.status === 'accepted' && (
            <button
              onClick={async () => {
                await convertToInvoices.mutateAsync(id!);
                navigate('/invoices');
              }}
              disabled={convertToInvoices.isPending}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {convertToInvoices.isPending ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}
        </div>
      </div>

      {pdfBlobUrl ? (
        <PdfInlinePreview blobUrl={pdfBlobUrl} filename={`${q.quotationNumber}.pdf`} />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
              <Calendar size={14} className="text-gray-400" />
              <div>
                <div className="text-xs text-gray-400">Issued</div>
                <div className="text-sm font-medium">{new Date(q.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>
            {q.validUntil && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                <Calendar size={14} className="text-gray-400" />
                <div>
                  <div className="text-xs text-gray-400">Valid Until</div>
                  <div className="text-sm font-medium">{new Date(q.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            {client && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
                <p className="font-medium">{client.name}</p>
                {client.contactPerson && <p className="text-sm text-gray-600">{client.contactPerson}</p>}
                {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
                {client.address && <p className="text-sm text-gray-600">{client.address}</p>}
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Line Items</h3>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">Qty</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Unit Price</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lineItems.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${item.waived ? 'line-through text-gray-400' : ''}`}>{formatMoney(item.unitPrice)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${item.waived ? 'text-green-600 font-medium' : ''}`}>
                        {item.waived ? 'WAIVED' : formatMoney(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-200 pt-2 mt-2 text-sm text-right space-y-1">
                <div className="text-gray-500">Subtotal: <span className="tabular-nums">{formatMoney(q.subtotal)}</span></div>
                {q.discount > 0 && <div className="text-gray-500">Discount{q.discountPercent ? ` (${q.discountPercent}%)` : ''}: <span className="tabular-nums">-{formatMoney(q.discount)}</span></div>}
                <div className="text-lg font-bold">Total: <span className="tabular-nums">{formatMoney(q.total)}</span></div>
              </div>
            </div>

            {q.paymentSchedule.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Schedule</h3>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Milestone</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-16">%</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.paymentSchedule.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-4 py-3">{m.milestone}</td>
                        <td className="px-4 py-3 text-right">{m.percentage}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(m.amount)}</td>
                        <td className="px-4 py-3 text-gray-600">{m.dueDescription}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {linkedInvoices && linkedInvoices.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Linked Invoices</h3>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Total</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Paid</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Due</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedInvoices.map((inv: Invoice) => (
                      <tr key={inv._id} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          <Link to={`/invoices/${inv._id}`} className="text-blue-600 hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.total)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.amountPaid)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.amountDue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                            inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {titleCase(inv.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {q.termsAndConditions && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Terms & Conditions</h3>
                <p className="text-sm whitespace-pre-wrap">{q.termsAndConditions}</p>
              </div>
            )}

            {q.notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
                <p className="text-sm">{q.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {q.companyChopUrl && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Company Chop</h3>
                  <img src={q.companyChopUrl} alt="Company chop" className="w-32 h-32 object-contain border rounded" />
                </div>
              )}
              {q.signatureUrl && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Signature</h3>
                  <img src={q.signatureUrl} alt="Signature" className="w-64 h-24 object-contain border rounded" />
                </div>
              )}
            </div>
          </div>

          {/* Dual Approval Progress */}
          {q.status === 'pending_approval' && (q.approvals?.length ?? 0) > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Approval Progress</h3>
              <p className="text-sm text-gray-500 mb-2">Requires approval from both William and Andy.</p>
              <div className="flex flex-wrap gap-2">
                {(q.approvals || []).map((a: ApprovalEntry, i: number) => {
                  const name = typeof a.user === 'object' ? a.user.name : 'Unknown';
                  return (
                    <span key={i} className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded text-sm font-medium">
                      <CheckCircle size={14} /> {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Approval Review */}
          {q.status === 'pending_approval' && isAdmin && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Review Quotation</h3>
              <p className="text-xs text-gray-500">Dual approval required -- both William and Andy must approve.</p>
              {(() => {
                const currentUserApproved = (q.approvals || []).some(
                  (a: ApprovalEntry) => {
                    const uid = typeof a.user === 'object' ? a.user._id : a.user;
                    return uid === user?.id;
                  },
                );
                return showReject ? (
                  <div className="space-y-2">
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for returning to draft (optional)..." rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={handleReject} disabled={reject.isPending} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                        {reject.isPending ? 'Returning...' : 'Confirm Return'}
                      </button>
                      <button onClick={() => setShowReject(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {currentUserApproved ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium px-4 py-1.5">
                        <CheckCircle size={14} /> You have approved -- waiting for the other approver
                      </span>
                    ) : (
                      <button onClick={handleApprove} disabled={approve.isPending} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50">
                        {approve.isPending ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                    <button onClick={() => setShowReject(true)} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700">
                      Return to Draft
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Activity History */}
          {q.activityLog && q.activityLog.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-1">
                <Clock size={14} /> History
              </h3>
              <div className="space-y-0">
                {q.activityLog.map((entry: QuotationActivityLog, i: number) => {
                  const cfg = actionConfig[entry.action] || actionConfig.created;
                  const Icon = cfg.icon;
                  const userName = typeof entry.user === 'object' ? entry.user.name : 'Unknown';
                  const isLast = i === q.activityLog!.length - 1;
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
      )}

      {/* Send for Approval Modal */}
      {showNotify && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Send for Approval</h3>
              <p className="text-sm text-gray-500 mt-1">Select who should review this quotation. Admins are always notified.</p>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto">
              {(allUsers || [])
                .filter((u) => u.active)
                .map((u) => {
                  const isAdminUser = u.role === 'admin';
                  const checked = selectedEmails.includes(u.email);
                  return (
                    <label
                      key={u._id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer hover:bg-gray-50 ${isAdminUser ? 'opacity-90' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmail(u.email, isAdminUser)}
                        disabled={isAdminUser}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{u.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isAdminUser ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {titleCase(u.role)}
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
