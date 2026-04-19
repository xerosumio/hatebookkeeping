import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInvoice, fetchPdfBlob } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { FileText, Pencil, ArrowLeft } from 'lucide-react';
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
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: inv, isLoading } = useInvoice(id || '');

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const showPdfPreview = useCallback(async () => {
    if (!id || !inv) return;
    setPdfLoading(true);
    try {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = await fetchPdfBlob(`/invoices/${id}/pdf`);
      setPdfBlobUrl(url);
    } catch {
      alert('Failed to generate PDF. Check server logs.');
    } finally {
      setPdfLoading(false);
    }
  }, [id, inv, pdfBlobUrl]);

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
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[inv.status]}`}>
            {inv.status}
          </span>
          {inv.status !== 'paid' && (
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
                  <th className="text-left py-2 font-medium text-gray-600">Description</th>
                  <th className="text-right py-2 font-medium text-gray-600 w-20">Qty</th>
                  <th className="text-right py-2 font-medium text-gray-600 w-32">Unit Price</th>
                  <th className="text-right py-2 font-medium text-gray-600 w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(item.amount)}</td>
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
        </div>
      )}
    </div>
  );
}
