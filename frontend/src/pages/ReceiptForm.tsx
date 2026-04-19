import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInvoice, useCreateReceipt } from '../api/hooks';
import { formatMoney, decimalToCents, centsToDecimal } from '../utils/money';
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

  useEffect(() => {
    if (invoice && invoice.amountDue > 0 && !amount) {
      setAmount(String(centsToDecimal(invoice.amountDue)));
    }
  }, [invoice]);

  const client = invoice && typeof invoice.client === 'object' ? (invoice.client as Client) : null;
  const amountCents = decimalToCents(Number(amount) || 0);
  const isFullPayment = invoice && amountCents === invoice.amountDue;
  const isOverpay = invoice && amountCents > invoice.amountDue;

  function handlePayFull() {
    if (invoice) setAmount(String(centsToDecimal(invoice.amountDue)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const receipt = await createReceipt.mutateAsync({
        invoice: invoiceId,
        amount: amountCents,
        paymentMethod,
        paymentDate,
        bankReference,
        notes,
      });
      navigate(`/receipts/${receipt._id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create receipt');
    }
  }

  if (!invoiceId) return <p className="text-gray-500">No invoice specified.</p>;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Record Payment</h1>

      {invoice && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="text-gray-500">Invoice</div>
            <div className="font-medium">{invoice.invoiceNumber}</div>
            {client && (
              <>
                <div className="text-gray-500">Client</div>
                <div className="font-medium">{client.name}</div>
              </>
            )}
            <div className="text-gray-500">Invoice Total</div>
            <div className="font-medium tabular-nums">{formatMoney(invoice.total)}</div>
            {invoice.amountPaid > 0 && (
              <>
                <div className="text-gray-500">Already Paid</div>
                <div className="font-medium tabular-nums text-green-600">{formatMoney(invoice.amountPaid)}</div>
              </>
            )}
            <div className="text-gray-500 font-medium">Amount Due</div>
            <div className="font-bold tabular-nums text-red-600">{formatMoney(invoice.amountDue)}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD) *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min={0.01}
              step={0.01}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {invoice && !isFullPayment && (
              <button
                type="button"
                onClick={handlePayFull}
                className="px-3 py-2 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 whitespace-nowrap"
              >
                Pay Full ({formatMoney(invoice.amountDue)})
              </button>
            )}
          </div>
          {isFullPayment && (
            <p className="text-xs text-green-600 mt-1">Full payment — invoice will be marked as paid</p>
          )}
          {isOverpay && (
            <p className="text-xs text-amber-600 mt-1">Amount exceeds balance due ({formatMoney(invoice!.amountDue)})</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
