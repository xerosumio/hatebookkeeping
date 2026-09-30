import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Stat, Chip } from '@naton/ui';
import { useFunds, useUpdateFund, useFundTransfer, useAdjustFund, useEntities } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../utils/money';
import { Pencil } from 'lucide-react';
import { Button } from '../components/ui/Button';
import type { Fund, Entity } from '../types';

const typeLabels: Record<string, string> = {
  reserve: 'Reserve',
  bank: 'Bank Account',
  petty_cash: 'Petty Cash',
};

const typeTones: Record<string, 'human' | 'signal' | 'authored'> = {
  reserve: 'authored',
  bank: 'human',
  petty_cash: 'signal',
};

function hkToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getHeldInId(fund: Fund): string | undefined {
  if (!fund.heldIn) return undefined;
  return typeof fund.heldIn === 'object' ? fund.heldIn._id : fund.heldIn;
}

export default function FundList() {
  const { user } = useAuth();
  const { data: funds, isLoading } = useFunds();
  const { data: entities } = useEntities();
  const updateMutation = useUpdateFund();
  const transferMutation = useFundTransfer();
  const adjustMutation = useAdjustFund();
  const canAdjustToBank = user?.role === 'admin' || !!user?.access?.adjustFund;

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromFund: '', toFund: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'reserve' as string, entity: '', heldIn: '', balance: '' });
  const [adjustingFund, setAdjustingFund] = useState<Fund | null>(null);
  const [adjustDate, setAdjustDate] = useState(hkToday());
  const [adjustNote, setAdjustNote] = useState('Balance adjustment to match Airwallex');
  const [adjustError, setAdjustError] = useState('');

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
  const totalBalance = activeFunds.filter((f) => f.type === 'bank' || f.type === 'petty_cash').reduce((s, f) => s + f.balance, 0);
  const bankFunds = activeFunds.filter((f) => f.type === 'bank');
  const standaloneFunds = activeFunds.filter((f) => f.type !== 'bank' && !getHeldInId(f));
  const earmarkedTotal = activeFunds
    .filter((f) => f.type === 'reserve' && getHeldInId(f))
    .reduce((s, f) => s + f.balance, 0);
  const operatingCash = totalBalance - earmarkedTotal;
  const airwallexDrifted = activeFunds.filter((f) => f.driftKind === 'airwallex' && (f.drift || 0) !== 0);
  const ledgerDrifted = activeFunds.filter((f) => f.driftKind !== 'airwallex' && (f.drift || 0) !== 0);

  function openAdjust(fund: Fund) {
    setAdjustingFund(fund);
    setAdjustDate(hkToday());
    setAdjustNote('Balance adjustment to match Airwallex');
    setAdjustError('');
  }

  async function handleAdjust() {
    if (!adjustingFund) return;
    setAdjustError('');
    try {
      await adjustMutation.mutateAsync({
        id: adjustingFund._id,
        date: adjustDate,
        note: adjustNote,
      });
      setAdjustingFund(null);
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setAdjustError(body?.message || body?.error || 'Adjustment failed');
    }
  }

  function canAdjust(fund: Fund) {
    if (fund.driftKind !== 'airwallex' || typeof fund.airwallexBalance !== 'number') return false;
    const historyEnd = fund.reconstructedBalance ?? fund.balance;
    return fund.balance !== fund.airwallexBalance || historyEnd !== fund.airwallexBalance;
  }

  function childrenOf(bankId: string) {
    return activeFunds.filter((f) => getHeldInId(f) === bankId);
  }

  if (isLoading) return <p className="font-mono text-[10px] text-ink-ghost">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-normal text-ink">Funds</h1>
        <Button onClick={() => setShowTransfer(true)}>Transfer</Button>
      </div>

      {airwallexDrifted.length > 0 && (
        <div className="mb-4 rounded-sm border border-signal-dim/60 bg-signal-wash px-4 py-3 font-mono text-[10px] text-signal">
          {airwallexDrifted.map((f) => f.name).join(', ')} {airwallexDrifted.length === 1 ? 'does' : 'do'} not match the live Airwallex bank balance.
        </div>
      )}
      {ledgerDrifted.length > 0 && (
        <div className="mb-4 rounded-sm border border-signal-dim/60 bg-signal-wash px-4 py-3 font-mono text-[10px] text-signal">
          {ledgerDrifted.length} fund{ledgerDrifted.length === 1 ? '' : 's'} have a stored balance that does not match opening + transactions + transfers.
        </div>
      )}

      <div className="mb-6 grid grid-cols-5 gap-4">
        <Stat
          n={formatMoney(totalBalance)}
          label="Total balance"
          ink={totalBalance >= 0 ? 'var(--color-authored)' : 'var(--color-breach)'}
        />
        <Stat
          n={formatMoney(operatingCash)}
          label="Operating cash"
          ink="var(--color-authored)"
          sub="Bank + petty − earmarked reserves"
        />
        {['reserve', 'bank', 'petty_cash'].map((t) => {
          const grouped = activeFunds.filter((f) => f.type === t);
          const sum = grouped.reduce((s, f) => s + f.balance, 0);
          return (
            <Stat
              key={t}
              n={formatMoney(sum)}
              label={typeLabels[t] ?? t}
              sub={`${grouped.length} account${grouped.length !== 1 ? 's' : ''}`}
            />
          );
        })}
      </div>

      <div className="space-y-4">
        {bankFunds.map((bank) => {
          const children = childrenOf(bank._id);
          const entObj = bank.entity && typeof bank.entity === 'object' ? bank.entity as Entity : null;

          return (
            <div key={bank._id} className="overflow-hidden rounded-md border border-hair bg-panel lift">
              <div className="flex items-center justify-between border-b border-hair bg-human-wash px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] font-medium text-human">{bank.name}</span>
                  <Chip tone="human">Bank Account</Chip>
                  {entObj && <span className="font-mono text-[9px] text-ink-ghost">{entObj.code}</span>}
                  {(bank.drift || 0) !== 0 && (
                    <Chip tone="signal">drift {formatMoney(bank.drift || 0)}</Chip>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] font-medium tabular-nums text-human">{formatMoney(bank.balance)}</span>
                  <button onClick={() => openEdit(bank)} className="text-ink-ghost hover:text-human"><Pencil size={12} className="inline" /></button>
                  {canAdjustToBank && canAdjust(bank) && (
                    <button type="button" onClick={() => openAdjust(bank)} className="font-mono text-[9px] text-signal hover:underline">Adjust</button>
                  )}
                  <Link to={`/funds/${bank._id}`} className="font-mono text-[9px] text-human hover:underline">History</Link>
                </div>
              </div>
              {children.length > 0 && (() => {
                const reserveTotal = children.reduce((s, c) => s + c.balance, 0);
                const operatingCash = bank.balance - reserveTotal;
                return (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {children.map((child) => (
                        <FundSubRow key={child._id} fund={child} onEdit={openEdit} />
                      ))}
                      <tr className="bg-emerald-50">
                        <td className="px-4 py-2.5 pl-8">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-700">Operating Cash</span>
                            <span className="text-xs text-emerald-500">= balance − reserves</span>
                          </div>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${operatingCash >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatMoney(operatingCash)}
                        </td>
                        <td className="px-4 py-2.5 w-32"></td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
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

      {adjustingFund && typeof adjustingFund.airwallexBalance === 'number' && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[28rem]">
            <h3 className="text-lg font-bold mb-1">Adjust {adjustingFund.name}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Posts one transfer so the history and the saved balance both equal the live Airwallex balance.
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">History ends at</span>
                <span className="font-mono">{formatMoney(adjustingFund.reconstructedBalance ?? adjustingFund.balance)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Saved balance</span>
                <span className="font-mono">{formatMoney(adjustingFund.balance)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Airwallex balance</span>
                <span className="font-mono">{formatMoney(adjustingFund.airwallexBalance)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">Transfer</span>
                <span className="font-mono">
                  {formatMoney(adjustingFund.airwallexBalance - (adjustingFund.reconstructedBalance ?? adjustingFund.balance))}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            {adjustError && <p className="text-sm text-red-600 mt-3">{adjustError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdjust} disabled={!adjustDate || adjustMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {adjustMutation.isPending ? 'Adjusting...' : 'Adjust'}
              </button>
              <button onClick={() => setAdjustingFund(null)} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
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
          <Chip tone={typeTones[fund.type] ?? 'neutral'}>{typeLabels[fund.type]}</Chip>
          {entObj && <span className="text-xs text-gray-400">{entObj.code}</span>}
          {(fund.drift || 0) !== 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              drift {formatMoney(fund.drift || 0)}
            </span>
          )}
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
