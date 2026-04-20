import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useReceipt, useDeleteReceipt, fetchPdfBlob } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { FileText, ArrowLeft, Trash2 } from 'lucide-react';
import PdfInlinePreview from '../components/PdfPreviewModal';
import type { Client, Invoice } from '../types';

const methodLabels: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  fps: 'FPS',
  other: 'Other',
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading } = useReceipt(id || '');
  const deleteReceipt = useDeleteReceipt();

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const showPdfPreview = useCallback(async () => {
    if (!id || !receipt) return;
    setPdfLoading(true);
    try {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = await fetchPdfBlob(`/receipts/${id}/pdf`);
      setPdfBlobUrl(url);
    } catch {
      alert('Failed to generate PDF. Check server logs.');
    } finally {
      setPdfLoading(false);
    }
  }, [id, receipt, pdfBlobUrl]);

  const hidePdfPreview = useCallback(() => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  }, [pdfBlobUrl]);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!receipt) return <p className="text-gray-500">Receipt not found.</p>;

  const client = typeof receipt.client === 'object' ? (receipt.client as Client) : null;
  const invoice = typeof receipt.invoice === 'object' ? (receipt.invoice as Invoice) : null;
  const quotation = invoice?.quotation && typeof invoice.quotation === 'object' ? invoice.quotation : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{receipt.receiptNumber}</h1>
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
          <button
            onClick={() => {
              if (confirm(`Delete receipt ${receipt.receiptNumber}? This will reverse the payment on the linked invoice.`)) {
                deleteReceipt.mutate(receipt._id, { onSuccess: () => navigate('/receipts') });
              }
            }}
            className="flex items-center gap-1 border border-red-300 text-red-600 px-3 py-1.5 rounded text-sm hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {pdfBlobUrl ? (
        <PdfInlinePreview blobUrl={pdfBlobUrl} filename={`${receipt.receiptNumber}.pdf`} />
      ) : (
        <div className="space-y-4">
          {/* Amount highlight */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Amount Received</p>
              {client && <p className="text-xs text-gray-500 mt-0.5">From {client.name}</p>}
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-700">{formatMoney(receipt.amount)}</p>
          </div>

          {/* Payment For (project context) */}
          {(invoice || quotation) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payment For</h3>
              {quotation && (
                <div className="mb-3">
                  <p className="font-semibold text-gray-900">{quotation.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Quotation:{' '}
                    <Link to={`/quotations/${quotation._id}`} className="text-blue-600 hover:underline">
                      {quotation.quotationNumber}
                    </Link>
                  </p>
                </div>
              )}
              {invoice && (
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Invoice</p>
                    <Link to={`/invoices/${invoice._id}`} className="text-blue-600 hover:underline font-medium">
                      {invoice.invoiceNumber}
                    </Link>
                  </div>
                  {invoice.milestone && (
                    <div>
                      <p className="text-xs text-gray-500">Milestone</p>
                      <p className="font-medium">{invoice.milestone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Invoice Total</p>
                    <p className="font-medium tabular-nums">{formatMoney(invoice.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Balance Due</p>
                    <p className={`font-medium tabular-nums ${invoice.amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatMoney(invoice.amountDue)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment details */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Date</h3>
                <p className="text-sm">{new Date(receipt.paymentDate).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Payment Method</h3>
                <p className="text-sm">{methodLabels[receipt.paymentMethod] || receipt.paymentMethod}</p>
              </div>
              {receipt.bankReference && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Bank Reference</h3>
                  <p className="text-sm">{receipt.bankReference}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {receipt.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
              <p className="text-sm whitespace-pre-line">{receipt.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
