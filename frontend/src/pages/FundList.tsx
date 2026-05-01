import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFunds, useUpdateFund, useFundTransfer, useEntities } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Pencil } from 'lucide-react';
import type { Fund, Entity } from '../types';

const typeLabels: Record<string, string> = {
  reserve: 'Reserve',
  bank: 'Bank Account',
  petty_cash: 'Petty Cash',
};

const typeColors: Record<string, string> = {
  reserve: 'bg-purple-50 text-purple-700',
  bank: 'bg-blue-50 text-blue-700',
  petty_cash: 'bg-amber-50 text-amber-700',
};

function getHeldInId(fund: Fund): string | undefined {
  if (!fund.heldIn) return undefined;
  return typeof fund.heldIn === 'object' ? fund.heldIn._id : fund.heldIn;
}

export default function FundList() {
  const { data: funds, isLoading } = useFunds();
  const { data: entities } = useEntities();
  const updateMutation = useUpdateFund();
  const transferMutation = useFundTransfer();

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromFund: '', toFund: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'reserve' as string, entity: '', heldIn: '', balance: '' });

  async function handleTransfer() {
    if (!transferForm.amount || !transferForm.description || (!transferForm.fromFund && !transferForm.toFund)) return;
    await transferMutation.mutateAsync({
      fromFund: transferForm.fromFund || undefined,
      toFund: transferForm.toFund || undefined,
      amount: Math.round(parseFloat(transferForm.amount) * 100),
      date: transferForm.date,
      description: transferForm.description,
    });
    setTransferForm({ fromFund: '', toFund: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    setShowTransfer(false);
  }

  function openEdit(fund: Fund) {
    const entId = fund.entity && typeof fund.entity === 'object' ? (fund.entity as Entity)._id : (fund.entity || '');
    const heldId = getHeldInId(fund) || '';
    const balVal = fund.type === 'bank' ? (fund.openingBalance / 100).toFixed(2) : (fund.balance / 100).toFixed(2);
    setEditForm({ name: fund.name, type: fund.type, entity: entId, heldIn: heldId, balance: balVal });
    setEditingFund(fund);
  }

  async function handleEdit() {
    if (!editingFund || !editForm.name) return;
    const cents = editForm.balance ? Math.round(parseFloat(editForm.balance) * 100) : 0;
    const isBankType = editForm.type === 'bank';
    await updateMutation.mutateAsync({
      id: editingFund._id,
      data: {
        name: editForm.name,
        type: editForm.type,
        entity: editForm.entity || null,
        heldIn: editForm.heldIn || null,
        ...(isBankType ? { openingBalance: cents } : { balance: cents }),
      },
    });
    setEditingFund(null);
  }

  const activeFunds = funds?.filter((f) => f.active) || [];
  const totalBalance = activeFunds.reduce((s, f) => s + f.balance, 0);
  const bankFunds = activeFunds.filter((f) => f.type === 'bank');
  const standaloneFunds = activeFunds.filter((f) => f.type !== 'bank' && !getHeldInId(f));

  function childrenOf(bankId: string) {
    return activeFunds.filter((f) => getHeldInId(f) === bankId);
  }

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Funds</h1>
        <button onClick={() => setShowTransfer(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Transfer
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-1">
          <div className="text-sm text-gray-500">Total Balance</div>
          <div className={`text-xl font-bold font-mono ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(totalBalance)}
          </div>
        </div>
        {['reserve', 'bank', 'petty_cash'].map((t) => {
          const grouped = activeFunds.filter((f) => f.type === t);
          const sum = grouped.reduce((s, f) => s + f.balance, 0);
          return (
            <div key={t} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-500">{typeLabels[t]}</div>
              <div className="text-lg font-bold font-mono">{formatMoney(sum)}</div>
              <div className="text-xs text-gray-400">{grouped.length} account{grouped.length !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {bankFunds.map((bank) => {
          const children = childrenOf(bank._id);
          const entObj = bank.entity && typeof bank.entity === 'object' ? bank.entity as Entity : null;

          return (
            <div key={bank._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-blue-800">{bank.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">Bank Account</span>
                  {entObj && <span className="text-xs text-blue-500">{entObj.code}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-blue-800">{formatMoney(bank.balance)}</span>
                  <button onClick={() => openEdit(bank)} className="text-xs text-gray-500 hover:text-blue-600"><Pencil size={12} className="inline" /></button>
                  <Link to={`/funds/${bank._id}`} className="text-xs text-blue-600 hover:underline">History</Link>
                </div>
              </div>
              {children.length > 0 && (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {children.map((child) => (
                      <FundSubRow key={child._id} fund={child} onEdit={openEdit} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}

        {standaloneFunds.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <span className="font-semibold text-gray-700">Standalone Accounts</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {standaloneFunds.map((fund) => (
                  <FundSubRow key={fund._id} fund={fund} onEdit={openEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTransfer && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Transfer Between Funds</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Fund</label>
                <select value={transferForm.fromFund} onChange={(e) => setTransferForm({ ...transferForm, fromFund: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">External (inflow)</option>
                  {activeFunds.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Fund</label>
                <select value={transferForm.toFund} onChange={(e) => setTransferForm({ ...transferForm, toFund: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">External (outflow)</option>
                  {activeFunds.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input type="number" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={transferForm.description} onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Transfer reason" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleTransfer}
                disabled={!transferForm.amount || !transferForm.description || (!transferForm.fromFund && !transferForm.toFund) || transferMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
              </button>
              <button onClick={() => setShowTransfer(false)} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingFund && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Edit Fund</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity (optional)</label>
                <select value={editForm.entity} onChange={(e) => setEditForm({ ...editForm, entity: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">None (Group-level)</option>
                  {entities?.map((ent) => <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>)}
                </select>
              </div>
              {editForm.type !== 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Held In (Bank Account)</label>
                  <select value={editForm.heldIn} onChange={(e) => setEditForm({ ...editForm, heldIn: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">None (standalone)</option>
                    {bankFunds.filter((b) => b._id !== editingFund._id).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editForm.type === 'bank' ? 'Opening Balance ($)' : 'Balance ($)'}
                </label>
                <input type="number" step="0.01" value={editForm.balance} onChange={(e) => setEditForm({ ...editForm, balance: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                {editForm.type === 'bank' && editingFund && (
                  <p className="text-xs text-gray-400 mt-1">Current balance: {formatMoney(editingFund.balance)} (opening + transactions)</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleEdit} disabled={!editForm.name || updateMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingFund(null)} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function FundSubRow({ fund, onEdit }: { fund: Fund; onEdit: (f: Fund) => void }) {
  const entObj = fund.entity && typeof fund.entity === 'object' ? fund.entity as Entity : null;
  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-4 py-2.5 pl-8">
        <div className="flex items-center gap-2">
          <span className="font-medium">{fund.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[fund.type]}`}>{typeLabels[fund.type]}</span>
          {entObj && <span className="text-xs text-gray-400">{entObj.code}</span>}
        </div>
      </td>
      <td className={`px-4 py-2.5 text-right font-mono font-medium ${fund.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatMoney(fund.balance)}
      </td>
      <td className="px-4 py-2.5 text-right w-32 space-x-2">
        <button onClick={() => onEdit(fund)} className="text-xs text-gray-500 hover:text-blue-600"><Pencil size={12} className="inline" /></button>
        <Link to={`/funds/${fund._id}`} className="text-xs text-blue-600 hover:underline">History</Link>
      </td>
    </tr>
  );
}
