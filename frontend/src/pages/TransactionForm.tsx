import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useCreateTransaction, useUpdateTransaction, useSettings } from '../api/hooks';
import { decimalToCents, centsToDecimal } from '../utils/money';
import type { Transaction } from '../types';

interface Props {
  onDone: () => void;
  existing?: Transaction | null;
}

export default function TransactionForm({ onDone, existing }: Props) {
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const { data: settings } = useSettings();
  const isEdit = !!existing;

  const categories = (settings?.chartOfAccounts || []).filter((a) => a.active);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    amount: '',
    bankReference: '',
    bankAccount: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      setForm({
        date: existing.date.slice(0, 10),
        type: existing.type,
        category: existing.category,
        description: existing.description,
        amount: String(centsToDecimal(existing.amount)),
        bankReference: existing.bankReference || '',
        bankAccount: existing.bankAccount || '',
      });
    }
  }, [existing]);

  const isPending = createTransaction.isPending || updateTransaction.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      amount: decimalToCents(Number(form.amount)),
    };
    try {
      if (isEdit) {
        await updateTransaction.mutateAsync({ id: existing!._id, data: payload });
      } else {
        await createTransaction.mutateAsync(payload);
      }
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} transaction`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">{isEdit ? 'Edit Transaction' : 'New Transaction'}</h3>
      {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select...</option>
            {categories
              .filter((a) => a.type === form.type)
              .map((a) => (
                <option key={a.code} value={a.name}>{a.name}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (HKD)</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            min={0.01}
            step={0.01}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Account</label>
          <input
            type="text"
            value={form.bankAccount}
            onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
            placeholder="e.g. HSBC HKD"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Reference</label>
          <input
            type="text"
            value={form.bankReference}
            onChange={(e) => setForm({ ...form, bankReference: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end">
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save' : 'Add'}
            </button>
            <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
