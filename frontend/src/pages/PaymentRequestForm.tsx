import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreatePaymentRequest } from '../api/hooks';
import { decimalToCents } from '../utils/money';

export default function PaymentRequestForm() {
  const navigate = useNavigate();
  const createRequest = useCreatePaymentRequest();
  const [form, setForm] = useState({
    type: 'salary' as 'salary' | 'reimbursement' | 'vendor_payment' | 'other',
    payee: '',
    description: '',
    amount: '',
  });
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createRequest.mutateAsync({
        ...form,
        amount: decimalToCents(Number(form.amount)),
      });
      navigate('/payment-requests');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create payment request');
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Payment Request</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="salary">Salary</option>
            <option value="reimbursement">Reimbursement</option>
            <option value="vendor_payment">Vendor Payment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payee *</label>
          <input
            type="text"
            value={form.payee}
            onChange={(e) => setForm({ ...form, payee: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD) *</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            min={0.01}
            step={0.01}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createRequest.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createRequest.isPending ? 'Submitting...' : 'Submit for Approval'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/payment-requests')}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
