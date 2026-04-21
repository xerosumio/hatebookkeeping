import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useInvoice, useUpdateInvoiceStatus, useDeleteInvoice, fetchPdfBlob } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { FileText, Pencil, ArrowLeft, Trash2 } from 'lucide-react';
import PdfInlinePreview from '../components/PdfPreviewModal';
import type { Client } from '../types';

const TERM_LABELS: Record<string, string> = {
  due_on_receipt: 'Due on Receipt',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

function termsLabel(terms: string): string {
  if (TERM_LABELS[terms]) return TERM_LABELS[terms];
  const m = terms.match(/^custom_(\d+)$/);
  if (m) return `Net ${m[1]}`;
  return terms;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: inv, isLoading } = useInvoice(id || '');
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [includeChop, setIncludeChop] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);

  const showPdfPreview = useCallback(async () => {
    if (!id || !inv) return;
    setPdfLoading(true);
    try {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const params = new URLSearchParams();
      params.set('includeChop', String(includeChop));
      params.set('includeSignature', String(includeSignature));
      const url = await fetchPdfBlob(`/invoices/${id}/pdf?${params}`);
      setPdfBlobUrl(url);
    } catch {
      alert('Failed to generate PDF. Check server logs.');
    } finally {
      setPdfLoading(false);
    }
  }, [id, inv, pdfBlobUrl, includeChop, includeSignature]);

  const hidePdfPreview = useCallback(() => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  }, [pdfBlobUrl]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!inv) return <p className="text-gray-500">Invoice not found.</p>;

  const client = typeof inv.client === 'object' ? (inv.client as Client) : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{inv.invoiceNumber}</h1>
          {inv.milestone && <p className="text-gray-500">{inv.milestone}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/invoices/${id}/edit`}
            className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
          >
            <Pencil size={14} /> Edit
          </Link>
          <button
            onClick={() => {
              if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                deleteInvoice.mutate(inv._id, { onSuccess: () => navigate('/invoices') });
              }
            }}
            className="flex items-center gap-1 border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
          {pdfBlobUrl ? (
            <button
              onClick={hidePdfPreview}
              className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
            >
              <ArrowLeft size={14} /> Back to Details
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={includeChop} onChange={(e) => setIncludeChop(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                Company Chop
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={includeSignature} onChange={(e) => setIncludeSignature(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                Signature
              </label>
              <button
                onClick={showPdfPreview}
                disabled={pdfLoading}
                className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <FileText size={14} /> {pdfLoading ? 'Loading...' : 'Preview PDF'}
              </button>
            </div>
          )}
          <select
            value={inv.status}
            onChange={(e) => updateStatus.mutate({ id: inv._id, data: { status: e.target.value } })}
            className={`px-3 py-1 rounded text-sm font-medium border-0 cursor-pointer ${statusColors[inv.status]}`}
          >
            <option value="draft">Draft</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          {inv.status === 'draft' && (
            <button
              onClick={() => updateStatus.mutate({ id: inv._id, data: { status: 'unpaid' } })}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
            >
              Mark as Sent
            </button>
          )}
          {(!inv.receipts || inv.receipts.length === 0) && inv.status !== 'draft' && (
            <Link
              to={`/receipts/new?invoiceId=${inv._id}`}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
            >
              Record Payment
            </Link>
          )}
        </div>
      </div>

      {pdfBlobUrl ? (
        <PdfInlinePreview blobUrl={pdfBlobUrl} filename={`${inv.invoiceNumber}.pdf`} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {client && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
              <p className="font-medium">{client.name}</p>
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
                {inv.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-200 pt-2 mt-2 text-sm text-right space-y-1">
              <div className="text-gray-500">Subtotal: <span className="tabular-nums">{formatMoney(inv.subtotal)}</span></div>
              {inv.discount > 0 && <div className="text-gray-500">Discount: <span className="tabular-nums">-{formatMoney(inv.discount)}</span></div>}
              <div className="font-bold">Total: <span className="tabular-nums">{formatMoney(inv.total)}</span></div>
              <div className="text-green-600">Paid: <span className="tabular-nums">{formatMoney(inv.amountPaid)}</span></div>
              <div className="text-lg font-bold text-red-600">Due: <span className="tabular-nums">{formatMoney(inv.amountDue)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inv.paymentTerms && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Terms</h3>
                <p className="text-sm">{termsLabel(inv.paymentTerms)}</p>
              </div>
            )}
            {inv.dueDate && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Due Date</h3>
                <p className="text-sm">{new Date(inv.dueDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {inv.bankAccountInfo && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Bank Account Info</h3>
              <p className="text-sm whitespace-pre-line">{inv.bankAccountInfo}</p>
            </div>
          )}

          {inv.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
              <p className="text-sm whitespace-pre-line">{inv.notes}</p>
            </div>
          )}

          {inv.receipts && inv.receipts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Receipts</h3>
              <div className="space-y-2">
                {inv.receipts.map((r) => (
                  <div key={r._id} className="flex items-center justify-between border border-gray-100 rounded p-3 bg-gray-50">
                    <div className="flex items-center gap-4">
                      <Link to={`/receipts/${r._id}`} className="text-blue-600 hover:underline font-medium text-sm">{r.receiptNumber}</Link>
                      <span className="text-sm text-gray-600">{formatMoney(r.amount)}</span>
                      <span className="text-xs text-gray-400">{new Date(r.paymentDate).toLocaleDateString()}</span>
                      {r.paymentMethod && <span className="text-xs text-gray-400 capitalize">{r.paymentMethod.replace(/_/g, ' ')}</span>}
                    </div>
                    <Link to={`/receipts/${r._id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
