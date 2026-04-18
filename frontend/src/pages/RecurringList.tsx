import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRecurringItems, useCreateRecurringItem, useDeleteRecurringItem, useGenerateRecurring } from '../api/hooks';
import { formatMoney, decimalToCents } from '../utils/money';
import { Plus, Trash2 } from 'lucide-react';
import type { Client } from '../types';

const categories = [
  'revenue', 'salary', 'reimbursement', 'rent', 'utilities',
  'software_subscription', 'professional_fees', 'tax', 'other',
];

export default function RecurringList() {
  const { data: items, isLoading } = useRecurringItems();
  const createItem = useCreateRecurringItem();
  const deleteItem = useDeleteRecurringItem();
  const generate = useGenerateRecurring();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'expense' as 'income' | 'expense', category: 'other',
    amount: '', frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    description: '', startDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createItem.mutateAsync({
        ...form,
        amount: decimalToCents(Number(form.amount)),
      });
      setShowForm(false);
      setForm({ name: '', type: 'expense', category: 'other', amount: '', frequency: 'monthly', description: '', startDate: new Date().toISOString().slice(0, 10) });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Recurring Items</h1>
        <div className="flex gap-2">
          <button
            onClick={() => generate.mutateAsync()}
            disabled={generate.isPending}
            className="border border-gray-300 px-4 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {generate.isPending ? 'Generating...' : 'Generate This Month'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (HKD)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required min={0.01} step={0.01} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as any })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createItem.isPending} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !items?.length ? (
        <p className="text-gray-500">No recurring items.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(item.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{item.frequency}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.client && typeof item.client === 'object' ? (item.client as unknown as Client).name : ''}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm('Delete?')) deleteItem.mutate(item._id); }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
