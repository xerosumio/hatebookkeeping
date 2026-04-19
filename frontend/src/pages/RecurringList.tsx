import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useRecurringItems, useCreateRecurringItem, useUpdateRecurringItem,
  useDeleteRecurringItem, useGenerateRecurring, useGenerateRecurringInvoice,
  useSettings, useClients, usePayees,
} from '../api/hooks';
import { formatMoney, decimalToCents, centsToDecimal } from '../utils/money';
import { Plus, Trash2, Pencil, X, Play, Pause, FileText, ChevronDown, ChevronRight, Bell, Receipt, CreditCard } from 'lucide-react';
import type { RecurringItem, RecurringHistoryEntry } from '../types';

function getNextDue(item: RecurringItem): Date | null {
  const start = new Date(item.startDate);
  const now = new Date();
  if (item.endDate && new Date(item.endDate) < now) return null;

  const dueDay = item.dueDay || 1;
  const freqMonths = item.frequency === 'monthly' ? 1 : item.frequency === 'quarterly' ? 3 : 12;

  let cursor = new Date(start.getFullYear(), start.getMonth(), dueDay);
  while (cursor < now) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + freqMonths, dueDay);
  }
  return cursor;
}

function getDueStatus(item: RecurringItem): 'due' | 'generated' | 'upcoming' {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastGen = item.lastGeneratedDate ? new Date(item.lastGeneratedDate) : null;

  if (lastGen && lastGen >= monthStart) return 'generated';

  const nextDue = getNextDue(item);
  if (!nextDue) return 'generated';

  if (nextDue <= new Date(now.getFullYear(), now.getMonth() + 1, 0)) return 'due';
  return 'upcoming';
}

const statusBadge: Record<string, { className: string; label: string }> = {
  due: { className: 'bg-amber-100 text-amber-700', label: 'Due' },
  generated: { className: 'bg-green-100 text-green-700', label: 'Generated' },
  upcoming: { className: 'bg-gray-100 text-gray-500', label: 'Upcoming' },
};

const actionBadge: Record<string, { className: string; label: string; icon: typeof FileText }> = {
  generated_invoice: { className: 'bg-blue-100 text-blue-700', label: 'Invoice', icon: FileText },
  generated_payment_request: { className: 'bg-purple-100 text-purple-700', label: 'Pay Request', icon: CreditCard },
  alert_sent: { className: 'bg-amber-100 text-amber-700', label: 'Alert', icon: Bell },
};

interface FormState {
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  client: string;
  payee: string;
  description: string;
  startDate: string;
  endDate: string;
  dueDay: string;
  alertDaysBefore: string;
  paymentTerms: string;
  bankAccountInfo: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  name: '', type: 'expense', category: '', amount: '', frequency: 'monthly',
  client: '', payee: '', description: '', startDate: new Date().toISOString().slice(0, 10),
  endDate: '', dueDay: '1', alertDaysBefore: '7', paymentTerms: '', bankAccountInfo: '', active: true,
});

export default function RecurringList() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const categories = (settings?.chartOfAccounts || []).filter((a) => a.active);
  const { data: items, isLoading } = useRecurringItems();
  const { data: clients } = useClients();
  const { data: payees } = usePayees();
  const createItem = useCreateRecurringItem();
  const updateItem = useUpdateRecurringItem();
  const deleteItem = useDeleteRecurringItem();
  const generate = useGenerateRecurring();
  const generateInvoice = useGenerateRecurringInvoice();

  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const filteredItems = (items || []).filter((i) => i.type === tab);
  const dueCount = (items || []).filter((i) => i.active && getDueStatus(i) === 'due').length;

  function toggleHistory(id: string) {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function buildPayload(f: FormState) {
    return {
      name: f.name,
      type: f.type,
      category: f.category,
      amount: decimalToCents(Number(f.amount)),
      frequency: f.frequency,
      client: f.client || undefined,
      payee: f.payee || undefined,
      description: f.description,
      startDate: f.startDate,
      endDate: f.endDate || undefined,
      dueDay: Number(f.dueDay) || 1,
      alertDaysBefore: Number(f.alertDaysBefore) || 7,
      paymentTerms: f.paymentTerms,
      bankAccountInfo: f.bankAccountInfo,
      active: f.active,
    };
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createItem.mutateAsync(buildPayload({ ...form, type: tab }));
      setShowForm(false);
      setForm(emptyForm());
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create');
    }
  }

  function startEdit(item: RecurringItem) {
    const clientId = item.client && typeof item.client === 'object' ? item.client._id : (item.client as string || '');
    const payeeId = item.payee && typeof item.payee === 'object' ? item.payee._id : (item.payee as string || '');
    setEditId(item._id);
    setEditForm({
      name: item.name,
      type: item.type,
      category: item.category,
      amount: String(centsToDecimal(item.amount)),
      frequency: item.frequency,
      client: clientId,
      payee: payeeId,
      description: item.description || '',
      startDate: item.startDate?.slice(0, 10) || '',
      endDate: item.endDate?.slice(0, 10) || '',
      dueDay: String(item.dueDay || 1),
      alertDaysBefore: String(item.alertDaysBefore ?? 7),
      paymentTerms: item.paymentTerms || '',
      bankAccountInfo: item.bankAccountInfo || '',
      active: item.active,
    });
    setError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setError('');
    try {
      await updateItem.mutateAsync({ id: editId, data: buildPayload(editForm) });
      setEditId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  }

  async function toggleActive(item: RecurringItem) {
    await updateItem.mutateAsync({
      id: item._id,
      data: {
        ...buildPayload({
          name: item.name,
          type: item.type,
          category: item.category,
          amount: String(centsToDecimal(item.amount)),
          frequency: item.frequency,
          client: item.client && typeof item.client === 'object' ? item.client._id : (item.client as string || ''),
          payee: item.payee && typeof item.payee === 'object' ? item.payee._id : (item.payee as string || ''),
          description: item.description || '',
          startDate: item.startDate?.slice(0, 10) || '',
          endDate: item.endDate?.slice(0, 10) || '',
          dueDay: String(item.dueDay || 1),
          alertDaysBefore: String(item.alertDaysBefore ?? 7),
          paymentTerms: item.paymentTerms || '',
          bankAccountInfo: item.bankAccountInfo || '',
          active: !item.active,
        }),
      },
    });
  }

  async function handleGenerateInvoice(itemId: string) {
    try {
      const result = await generateInvoice.mutateAsync(itemId);
      navigate(`/invoices/${result.invoiceId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate invoice');
    }
  }

  function renderForm(f: FormState, setF: (v: FormState) => void, onSubmit: (e: FormEvent) => void, submitLabel: string, onCancel: () => void, isPending: boolean) {
    const isIncome = f.type === 'income' || tab === 'income';
    return (
      <form onSubmit={onSubmit} className="space-y-3">
        {error && <div className="bg-red-50 text-red-600 text-sm p-2 rounded">{error}</div>}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Select...</option>
              {categories.filter((a) => a.type === tab).map((a) => <option key={a.code} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (HKD) *</label>
            <input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required min={0.01} step={0.01} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Frequency *</label>
            <select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as any })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {isIncome ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client *</label>
              <select value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="">Select client...</option>
                {clients?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payee</label>
              <select value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                <option value="">Select payee...</option>
                {payees?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
            <input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Due Day (1-28) *</label>
            <input type="number" value={f.dueDay} onChange={(e) => setF({ ...f, dueDay: e.target.value })} required min={1} max={28} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alert Days Before</label>
            <input type="number" value={f.alertDaysBefore} onChange={(e) => setF({ ...f, alertDaysBefore: e.target.value })} min={0} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          {isIncome && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms</label>
                <select value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="">None</option>
                  <option value="due_on_receipt">Due on Receipt</option>
                  <option value="net_30">Net 30</option>
                  <option value="net_60">Net 60</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bank Account Info</label>
                <input type="text" value={f.bankAccountInfo} onChange={(e) => setF({ ...f, bankAccountInfo: e.target.value })} placeholder="e.g. HSBC 123-456789-001" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{submitLabel}</button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:underline">Cancel</button>
        </div>
      </form>
    );
  }

  function renderHistoryEntry(entry: RecurringHistoryEntry) {
    const badge = actionBadge[entry.action] || { className: 'bg-gray-100 text-gray-600', label: entry.action, icon: Bell };
    const Icon = badge.icon;

    let link: string | null = null;
    if (entry.referenceId) {
      link = entry.referenceModel === 'Invoice'
        ? `/invoices/${entry.referenceId}`
        : `/payment-requests/${entry.referenceId}`;
    }

    return (
      <div className="flex items-center gap-3 py-2 px-3 border-b border-gray-50 last:border-0">
        <Icon size={14} className="text-gray-400 shrink-0" />
        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-xs text-gray-500 shrink-0">
          {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-xs text-gray-600 truncate flex-1">{entry.note || ''}</span>
        {link && (
          <button
            onClick={() => navigate(link!)}
            className="text-xs text-blue-600 hover:underline shrink-0"
          >
            View
          </button>
        )}
      </div>
    );
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
            {generate.isPending ? 'Generating...' : `Generate${dueCount > 0 ? ` (${dueCount} due)` : ''}`}
          </button>
          <button
            onClick={() => { setShowForm(true); setForm({ ...emptyForm(), type: tab }); }}
            className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['expense', 'income'] as const).map((t) => {
          const count = (items || []).filter((i) => i.type === t).length;
          return (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false); setEditId(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'expense' ? 'Expenses' : 'Income'} ({count})
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">New {tab === 'income' ? 'Income' : 'Expense'} Item</h3>
          {renderForm(form, setForm, handleAdd, 'Add', () => setShowForm(false), createItem.isPending)}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !filteredItems.length ? (
        <p className="text-gray-500">No {tab} recurring items.</p>
      ) : (
        <div className="space-y-0">
          {filteredItems.map((item) => {
            const isEditing = editId === item._id;
            const status = item.active ? getDueStatus(item) : null;
            const nextDue = item.active ? getNextDue(item) : null;
            const clientName = item.client && typeof item.client === 'object' ? item.client.name : '';
            const payeeName = item.payee && typeof item.payee === 'object' ? item.payee.name : '';
            const historyOpen = expandedHistory.has(item._id);
            const historyEntries: RecurringHistoryEntry[] = item.history || [];

            if (isEditing) {
              return (
                <div key={item._id} className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Edit Item</h3>
                    <button onClick={() => setEditId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={16} /></button>
                  </div>
                  {renderForm(editForm, setEditForm, (e) => { e.preventDefault(); saveEdit(); }, 'Save Changes', () => setEditId(null), updateItem.isPending)}
                </div>
              );
            }

            return (
              <div key={item._id} className={`bg-white border border-gray-200 rounded-lg mb-2 ${!item.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center px-5 py-3.5">
                  <div className="flex-1 min-w-0 grid grid-cols-7 gap-4 items-center">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                    </div>
                    <div>
                      {tab === 'income' ? (
                        <p className="text-sm text-gray-600">{clientName || <span className="text-gray-300">No client</span>}</p>
                      ) : (
                        <p className="text-sm text-gray-600">{payeeName || <span className="text-gray-300">No payee</span>}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm tabular-nums">{formatMoney(item.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 capitalize">{item.frequency}</p>
                      <p className="text-xs text-gray-400">Day {item.dueDay || 1}</p>
                    </div>
                    <div>
                      {nextDue ? (
                        <p className="text-xs text-gray-500">{nextDue.toLocaleDateString()}</p>
                      ) : (
                        <p className="text-xs text-gray-300">N/A</p>
                      )}
                      {item.lastGeneratedDate && (
                        <p className="text-xs text-gray-400">Last: {new Date(item.lastGeneratedDate).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">
                        <Bell size={10} className="inline mr-1" />{item.alertDaysBefore ?? 7}d before
                      </p>
                    </div>
                    <div>
                      {status ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[status].className}`}>
                          {statusBadge[status].label}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400">Paused</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    {tab === 'income' && item.active && (
                      <button
                        onClick={() => handleGenerateInvoice(item._id)}
                        disabled={generateInvoice.isPending}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        title="Generate Invoice"
                      >
                        <Receipt size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleHistory(item._id)}
                      className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                      title="History"
                    >
                      {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded text-gray-500 hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
                    <button
                      onClick={() => toggleActive(item)}
                      className={`p-1.5 rounded ${item.active ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                      title={item.active ? 'Pause' : 'Resume'}
                    >
                      {item.active ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete?')) deleteItem.mutate(item._id); }}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {historyOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-2">
                    {historyEntries.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">No history yet.</p>
                    ) : (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">History ({historyEntries.length})</p>
                        {[...historyEntries].reverse().map((entry, i) => (
                          <div key={i}>{renderHistoryEntry(entry)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
