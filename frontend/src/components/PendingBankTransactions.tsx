import { useState } from 'react';
import {
  usePendingBankTransactions,
  useMatchPending,
  useCreateFromPending,
  useDismissPending,
  useTransactions,
  useSettings,
  useEntities,
} from '../api/hooks';
import { formatMoney, titleCase } from '../utils/money';
import { FUND_NAMES, ENTITY_LABELS } from '../utils/bankAccounts';
import { Link2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface PendingItem {
  _id: string;
  airwallexId: string;
  entity: 'ax' | 'nt';
  type: 'income' | 'expense';
  amount: number;
  rawAmount: number;
  date: string;
  description: string;
  sourceType: string;
  transactionType: string;
}

function MatchModal({ item, onClose }: { item: PendingItem; onClose: () => void }) {
  const matchMutation = useMatchPending();
  const { data: txns, isLoading } = useTransactions({ reconciled: 'false', type: item.type });

  const candidates = (txns || [])
    .filter((t) => {
      return t.bankAccount === FUND_NAMES[item.entity] || !t.bankAccount;
    })
    .sort((a, b) => {
      const aMatch = a.amount === item.amount ? 0 : 1;
      const bMatch = b.amount === item.amount ? 0 : 1;
      return aMatch - bMatch;
    });

  function handleMatch(txnId: string) {
    matchMutation.mutate({ id: item._id, transactionId: txnId }, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[640px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold">Link to Existing Transaction</h3>
            <p className="text-sm text-gray-500 mt-1">
              Bank: {item.type} of {formatMoney(item.amount)} on {new Date(item.date).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading unreconciled transactions...</p>
        ) : !candidates.length ? (
          <p className="text-gray-500 text-sm">No unreconciled {item.type} transactions found for this bank account.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 hover:bg-blue-50">
                  <td className="px-3 py-2 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{t.description}</td>
                  <td className={`px-3 py-2 text-right font-mono ${t.amount === item.amount ? 'text-green-600 font-medium' : ''}`}>
                    {formatMoney(t.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleMatch(t._id)}
                      disabled={matchMutation.isPending}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 text-right">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateForm({ item, onClose }: { item: PendingItem; onClose: () => void }) {
  const createMutation = useCreateFromPending();
  const { data: settings } = useSettings();
  const { data: entities } = useEntities();
  const categories = (settings?.chartOfAccounts || []).filter((a) => a.active && a.type === item.type);

  const [form, setForm] = useState({
    category: categories[0]?.code || '',
    description: item.description || '',
    entity: '',
  });

  function handleSubmit() {
    if (!form.category || !form.description) return;
    createMutation.mutate(
      { id: item._id, data: { category: form.category, description: form.description, entity: form.entity || undefined } },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold">Create Transaction</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <span className={`font-medium ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{titleCase(item.type)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Amount</span>
            <span className="font-mono font-medium">{formatMoney(item.amount)}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Date</span>
            <span>{new Date(item.date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-500">Account</span>
            <span>{ENTITY_LABELS[item.entity]} Airwallex</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
            <select
              value={form.entity}
              onChange={(e) => setForm({ ...form, entity: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {entities?.map((ent) => (
                <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSubmit}
            disabled={!form.category || !form.description || createMutation.isPending}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendingBankTransactions() {
  const { data: items, isLoading } = usePendingBankTransactions();
  const dismissMutation = useDismissPending();
  const [matchItem, setMatchItem] = useState<PendingItem | null>(null);
  const [createItem, setCreateItem] = useState<PendingItem | null>(null);

  if (isLoading) return <p className="text-gray-500 text-sm">Loading pending items...</p>;
  if (!items?.length) return <p className="text-gray-400 text-sm">No pending bank transactions.</p>;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(items as PendingItem[]).map((item) => (
              <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium">{ENTITY_LABELS[item.entity]}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    item.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {titleCase(item.type)}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-mono ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {item.type === 'income' ? '+' : '-'}{formatMoney(item.amount)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.description}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setMatchItem(item)}
                      className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                      title="Link to existing transaction"
                    >
                      <Link2 size={12} /> Link
                    </button>
                    <button
                      onClick={() => setCreateItem(item)}
                      className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                      title="Create new transaction"
                    >
                      <Plus size={12} /> Create
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Dismiss this bank transaction? It will no longer appear as pending.')) {
                          dismissMutation.mutate({ id: item._id });
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
                      title="Dismiss"
                    >
                      <X size={12} /> Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matchItem && <MatchModal item={matchItem} onClose={() => setMatchItem(null)} />}
      {createItem && <CreateForm item={createItem} onClose={() => setCreateItem(null)} />}
    </>
  );
}

export function PendingBanner() {
  const [expanded, setExpanded] = useState(false);
  const { data: items } = usePendingBankTransactions();
  const count = items?.length ?? 0;

  if (count === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm hover:bg-amber-100 transition-colors"
      >
        <span className="text-amber-800 font-medium">
          {count} unmatched bank transaction{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} review
        </span>
        {expanded ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
      </button>
      {expanded && (
        <div className="mt-2">
          <PendingBankTransactions />
        </div>
      )}
    </div>
  );
}
