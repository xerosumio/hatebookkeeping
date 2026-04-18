import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvoice, useCreateReceipt } from '../api/hooks';
import { formatMoney, decimalToCents } from '../utils/money';
import type { Client } from '../types';

export default function ReceiptForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoiceId') || '';
  const { data: invoice } = useInvoice(invoiceId);
  const createReceipt = useCreateReceipt();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const client = invoice && typeof invoice.client === 'object' ? (invoice.client as Client) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createReceipt.mutateAsync({
        invoice: invoiceId,
        amount: decimalToCents(Number(amount)),
        paymentMethod,
        paymentDate,
        bankReference,
        notes,
      });
      navigate(`/invoices/${invoiceId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create receipt');
    }
  }

  if (!invoiceId) return <p className="text-gray-500">No invoice specified.</p>;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Record Payment</h1>

      {invoice && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm space-y-1">
          <div><span className="text-gray-500">Invoice:</span> {invoice.invoiceNumber}</div>
          {client && <div><span className="text-gray-500">Client:</span> {client.name}</div>}
          <div><span className="text-gray-500">Total:</span> {formatMoney(invoice.total)}</div>
          <div><span className="text-gray-500">Amount Due:</span> <span className="font-bold text-red-600">{formatMoney(invoice.amountDue)}</span></div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min={0.01}
            step={0.01}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="fps">FPS</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Reference</label>
          <input
            type="text"
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value)}
            placeholder="Transaction ID or reference number"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createReceipt.isPending}
            className="bg-green-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {createReceipt.isPending ? 'Recording...' : 'Record Payment'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
