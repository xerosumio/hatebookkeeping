import { useParams, Link } from 'react-router-dom';
import { useInvoice } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Download } from 'lucide-react';
import type { Client } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || '';

const statusColors: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: inv, isLoading } = useInvoice(id || '');

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
          <a
            href={`${apiUrl}/api/invoices/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
          >
            <Download size={14} /> PDF
          </a>
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
                <th className="text-right py-2 font-medium text-gray-600 w-28">Unit Price</th>
                <th className="text-right py-2 font-medium text-gray-600 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-mono">{formatMoney(item.unitPrice)}</td>
                  <td className="py-2 text-right font-mono">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 pt-2 mt-2 text-sm text-right space-y-1">
            <div className="text-gray-500">Subtotal: {formatMoney(inv.subtotal)}</div>
            {inv.discount > 0 && <div className="text-gray-500">Discount: -{formatMoney(inv.discount)}</div>}
            <div className="font-bold">Total: {formatMoney(inv.total)}</div>
            <div className="text-green-600">Paid: {formatMoney(inv.amountPaid)}</div>
            <div className="text-lg font-bold text-red-600">Due: {formatMoney(inv.amountDue)}</div>
          </div>
        </div>

        {inv.dueDate && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Due Date</h3>
            <p className="text-sm">{new Date(inv.dueDate).toLocaleDateString()}</p>
          </div>
        )}

        {inv.notes && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
            <p className="text-sm">{inv.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
