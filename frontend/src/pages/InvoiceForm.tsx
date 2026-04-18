import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients, useCreateInvoice } from '../api/hooks';
import LineItemEditor from '../components/LineItemEditor';
import { formatMoney, decimalToCents } from '../utils/money';
import type { LineItem } from '../types';

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const createInvoice = useCreateInvoice();

  const [client, setClient] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountCents = decimalToCents(discount);
  const total = subtotal - discountCents;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createInvoice.mutateAsync({
        client,
        lineItems,
        subtotal,
        discount: discountCents,
        total,
        dueDate: dueDate || undefined,
        notes,
      });
      navigate('/invoices');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">New Invoice</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client...</option>
              {clients?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <LineItemEditor items={lineItems} onChange={setLineItems} />

        <div className="flex justify-end gap-6 text-sm border-t border-gray-200 pt-4">
          <div className="text-right space-y-1">
            <div className="text-gray-500">Subtotal: <span className="font-mono">{formatMoney(subtotal)}</span></div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-gray-500">Discount:</span>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-lg font-bold">Total: <span className="font-mono">{formatMoney(total)}</span></div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={createInvoice.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
