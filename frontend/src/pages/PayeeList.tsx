import { useState } from 'react';
import { usePayees, useCreatePayee, useUpdatePayee, useDeletePayee, useEntities } from '../api/hooks';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Payee, Entity } from '../types';

export default function PayeeList() {
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();
  const { data: payees, isLoading } = usePayees(
    entityFilter ? { entity: entityFilter } : undefined,
  );
  const createPayee = useCreatePayee();
  const updatePayee = useUpdatePayee();
  const deletePayee = useDeletePayee();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Payee | null>(null);
  const [form, setForm] = useState({ name: '', bankName: '', bankAccountNumber: '', bankCode: '', notes: '' });
  const [error, setError] = useState('');

  function startCreate() {
    setEditing(null);
    setForm({ name: '', bankName: '', bankAccountNumber: '', bankCode: '', notes: '' });
    setShowForm(true);
  }

  function startEdit(p: Payee) {
    setEditing(p);
    setForm({ name: p.name, bankName: p.bankName, bankAccountNumber: p.bankAccountNumber, bankCode: p.bankCode, notes: p.notes });
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditing(null);
    setError('');
  }

  async function handleSubmit() {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    try {
      if (editing) {
        await updatePayee.mutateAsync({ id: editing._id, data: form });
      } else {
        await createPayee.mutateAsync(form);
      }
      cancel();
    } catch {
      setError(`Failed to ${editing ? 'update' : 'create'} payee`);
    }
  }

  function handleDelete(p: Payee) {
    if (confirm(`Delete payee "${p.name}"?`)) {
      deletePayee.mutate(p._id);
    }
  }

  const isPending = createPayee.isPending || updatePayee.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Payees</h1>
        {!showForm && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add Payee
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Entities</option>
          {entities?.map((ent) => (
            <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? 'Edit Payee' : 'New Payee'}</h3>
          {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
              <input
                type="text"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SWIFT / Bank Code</label>
              <input
                type="text"
                value={form.bankCode}
                onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={14} /> {isPending ? 'Saving...' : editing ? 'Save' : 'Create'}
            </button>
            <button onClick={cancel} className="flex items-center gap-1 text-sm text-gray-500 hover:underline">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !payees?.length ? (
        <p className="text-gray-500">No payees yet. Add one to get started.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Bank</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SWIFT / Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payees.map((p) => (
                <tr key={p._id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.entity && typeof p.entity === 'object' ? (p.entity as Entity).code : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.bankName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.bankAccountNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.bankCode || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.notes || ''}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-blue-600 p-1" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
