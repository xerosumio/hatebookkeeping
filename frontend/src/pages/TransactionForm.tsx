import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCreateTransaction, useUpdateTransaction, useSettings, useEntities, useClients, usePayees } from '../api/hooks';
import { decimalToCents, centsToDecimal } from '../utils/money';
import type { Transaction, Entity } from '../types';

interface Props {
  onDone: () => void;
  existing?: Transaction | null;
}

export default function TransactionForm({ onDone, existing }: Props) {
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const { data: settings } = useSettings();
  const { data: entities } = useEntities();
  const { data: clients } = useClients();
  const { data: payees } = usePayees();
  const isEdit = !!existing;

  const categories = (settings?.chartOfAccounts || []).filter((a) => a.active);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'expense' as 'income' | 'expense',
    category: '',
    description: '',
    amount: '',
    entity: '',
    client: '',
    payee: '',
    bankReference: '',
    bankAccount: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing) {
      const entId = existing.entity && typeof existing.entity === 'object'
        ? (existing.entity as Entity)._id
        : (existing.entity as string || '');
      const clientId = existing.client && typeof existing.client === 'object'
        ? existing.client._id
        : (existing.client as string || '');
      const payeeId = existing.payee && typeof existing.payee === 'object'
        ? existing.payee._id
        : (existing.payee as string || '');
      let resolvedClientId = clientId;
      if (!resolvedClientId && existing.invoice && typeof existing.invoice === 'object' && existing.invoice.client) {
        const invClient = existing.invoice.client;
        resolvedClientId = typeof invClient === 'object' ? invClient._id : invClient;
      }
      setForm({
        date: existing.date.slice(0, 10),
        type: existing.type,
        category: existing.category,
        description: existing.description,
        amount: String(centsToDecimal(existing.amount)),
        entity: entId,
        client: resolvedClientId,
        payee: payeeId,
        bankReference: existing.bankReference || '',
        bankAccount: existing.bankAccount || '',
      });
    }
  }, [existing]);

  const selectedEntity = entities?.find((e) => e._id === form.entity);
  const bankAccountOptions = selectedEntity?.bankAccounts || [];

  const isPending = createTransaction.isPending || updateTransaction.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      amount: decimalToCents(Number(form.amount)),
      entity: form.entity || undefined,
      client: form.client || undefined,
      payee: form.payee || undefined,
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
      <div className="grid grid-cols-5 gap-3">
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Entity</label>
          <select
            value={form.entity}
            onChange={(e) => setForm({ ...form, entity: e.target.value, bankAccount: '' })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select entity...</option>
            {entities?.map((ent) => (
              <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
          <select
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select client...</option>
            {clients?.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payee</label>
          <select
            value={form.payee}
            onChange={(e) => setForm({ ...form, payee: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select payee...</option>
            {payees?.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
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
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Account</label>
          <select
            value={form.bankAccount}
            onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Select account...</option>
            {bankAccountOptions.map((acc, i) => (
              <option key={i} value={acc.name}>
                {acc.name}{acc.bankName ? ` (${acc.bankName})` : ''}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Linked Documents</label>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {existing?.invoice && typeof existing.invoice === 'object' && (
                <Link
                  to={`/invoices/${existing.invoice._id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100"
                >
                  Invoice: {existing.invoice.invoiceNumber}
                </Link>
              )}
              {existing?.receipt && typeof existing.receipt === 'object' && (
                <Link
                  to={`/receipts/${(existing.receipt as { _id: string; receiptNumber: string })._id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100"
                >
                  Receipt: {(existing.receipt as { _id: string; receiptNumber: string }).receiptNumber}
                </Link>
              )}
              {existing?.paymentRequest && typeof existing.paymentRequest === 'object' && (
                <Link
                  to={`/payment-requests/${existing.paymentRequest._id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100"
                >
                  Payment Request: {existing.paymentRequest.requestNumber}
                </Link>
              )}
              {!(existing?.invoice && typeof existing.invoice === 'object') &&
               !(existing?.receipt && typeof existing.receipt === 'object') &&
               !(existing?.paymentRequest && typeof existing.paymentRequest === 'object') && (
                <span className="text-xs text-gray-400">No linked documents</span>
              )}
            </div>
          </div>
        )}
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
