import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useShareholders, useInvestShareholder, useShareTransfer,
  useShareholderLiabilities, useCreateShareholderLiability, useUpdateShareholderLiability, useDeleteShareholderLiability,
} from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Pencil, Trash2 } from 'lucide-react';
import type { ShareLiabilityEntry } from '../types';

export default function ShareholderList() {
  const navigate = useNavigate();
  const { data: shareholders, isLoading } = useShareholders();
  const investMutation = useInvestShareholder();
  const transferMutation = useShareTransfer();
  const createLiabilityMutation = useCreateShareholderLiability();
  const updateLiabilityMutation = useUpdateShareholderLiability();
  const deleteLiabilityMutation = useDeleteShareholderLiability();

  const [transferModal, setTransferModal] = useState<{ fromId: string; fromName: string } | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferPercent, setTransferPercent] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [investModal, setInvestModal] = useState<{ id: string; name: string } | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investDate, setInvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [investDesc, setInvestDesc] = useState('');

  const [addEntryModal, setAddEntryModal] = useState<{ id: string; name: string } | null>(null);
  const [entryType, setEntryType] = useState<'purchase' | 'payment'>('purchase');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryDesc, setEntryDesc] = useState('');

  const [editEntry, setEditEntry] = useState<{ shareholderId: string; entry: ShareLiabilityEntry } | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [historyModal, setHistoryModal] = useState<{ id: string; name: string } | null>(null);

  const totalEquity = shareholders?.reduce((sum, s) => sum + (s.currentEquity || 0), 0) || 0;
  const totalInvested = shareholders?.reduce((sum, s) => sum + (s.totalInvested || 0), 0) || 0;
  const valuePerPercent = totalEquity / 100;

  async function handleInvest() {
    if (!investModal || !investAmount) return;
    const cents = Math.round(parseFloat(investAmount) * 100);
    await investMutation.mutateAsync({
      id: investModal.id,
      data: { amount: cents, date: investDate, description: investDesc || undefined },
    });
    setInvestModal(null);
    setInvestAmount('');
    setInvestDesc('');
  }

  async function handleTransfer() {
    if (!transferModal || !transferTo || !transferPercent) return;
    await transferMutation.mutateAsync({
      from: transferModal.fromId,
      to: transferTo,
      percent: parseFloat(transferPercent),
      reason: transferReason || undefined,
    });
    setTransferModal(null);
    setTransferTo('');
    setTransferPercent('');
    setTransferReason('');
  }

  async function handleAddEntry() {
    if (!addEntryModal || !entryAmount) return;
    const cents = Math.round(parseFloat(entryAmount) * 100);
    await createLiabilityMutation.mutateAsync({
      id: addEntryModal.id,
      data: { type: entryType, amount: cents, date: entryDate, description: entryDesc || undefined },
    });
    setAddEntryModal(null);
    setEntryAmount('');
    setEntryDesc('');
    setEntryType('purchase');
  }

  async function handleEditEntry() {
    if (!editEntry) return;
    await updateLiabilityMutation.mutateAsync({
      shareholderId: editEntry.shareholderId,
      entryId: editEntry.entry._id,
      data: {
        amount: Math.round(parseFloat(editAmount) * 100),
        date: editDate,
        description: editDesc,
      },
    });
    setEditEntry(null);
  }

  async function handleDeleteEntry(shareholderId: string, entryId: string) {
    if (!confirm('Delete this liability entry?')) return;
    await deleteLiabilityMutation.mutateAsync({ shareholderId, entryId });
  }

  const shareholdersWithLiability = shareholders?.filter((s) => s.sharePurchaseOwed > 0 || s.sharePurchasePaid > 0) || [];

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Shareholders</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Invested</div>
          <div className="text-xl font-bold font-mono">{formatMoney(totalInvested)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Current Total Equity</div>
          <div className="text-xl font-bold font-mono">{formatMoney(totalEquity)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Value per 1%</div>
          <div className="text-xl font-bold font-mono">{formatMoney(valuePerPercent)}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Share %</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Share Value (HKD)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total Invested</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Current Equity</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shareholders?.map((sh) => (
              <tr key={sh._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/shareholders/${sh._id}`)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {sh.name}
                  </button>
                  {typeof sh.user === 'object' && (
                    <div className="text-xs text-gray-400">{sh.user.email}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono">{sh.sharePercent.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {formatMoney(Math.round(sh.sharePercent * valuePerPercent))}
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(sh.totalInvested || 0)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(sh.currentEquity || 0)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setTransferModal({ fromId: sh._id, fromName: sh.name });
                      setTransferTo('');
                      setTransferPercent('');
                      setTransferReason('');
                    }}
                    className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 mr-1"
                  >
                    Transfer %
                  </button>
                  <button
                    onClick={() => setInvestModal({ id: sh._id, name: sh.name })}
                    className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                  >
                    + Invest
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shareholdersWithLiability.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3">Share Purchase Liabilities</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Owed</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Already Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Outstanding</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shareholdersWithLiability.map((sh) => {
                  const outstanding = sh.sharePurchaseOwed - sh.sharePurchasePaid;
                  return (
                    <tr key={sh._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{sh.name}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(sh.sharePurchaseOwed)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(sh.sharePurchasePaid)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-600 font-semibold">{formatMoney(outstanding)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => {
                            setAddEntryModal({ id: sh._id, name: sh.name });
                            setEntryType('purchase');
                            setEntryAmount('');
                            setEntryDate(new Date().toISOString().slice(0, 10));
                            setEntryDesc('');
                          }}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          + Entry
                        </button>
                        <button
                          onClick={() => setHistoryModal({ id: sh._id, name: sh.name })}
                          className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {investModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Record Investment — {investModal.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD)</label>
                <input type="number" step="0.01" value={investAmount} onChange={(e) => setInvestAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={investDate} onChange={(e) => setInvestDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={investDesc} onChange={(e) => setInvestDesc(e.target.value)}
                  placeholder="Capital investment" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleInvest} disabled={!investAmount || investMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {investMutation.isPending ? 'Saving...' : 'Record Investment'}
              </button>
              <button onClick={() => setInvestModal(null)}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Transfer Shares</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm font-medium">
                  {transferModal.fromName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">Select shareholder...</option>
                  {shareholders?.filter((s) => s._id !== transferModal.fromId).map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.sharePercent.toFixed(2)}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Percentage to Transfer</label>
                <input type="number" step="0.01" value={transferPercent} onChange={(e) => setTransferPercent(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. 5.00" autoFocus />
                {transferPercent && (
                  <div className="text-xs text-gray-500 mt-1">
                    Value: {formatMoney(Math.round(parseFloat(transferPercent) * valuePerPercent))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input type="text" value={transferReason} onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Reason for transfer" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleTransfer}
                disabled={!transferTo || !transferPercent || transferMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {transferMutation.isPending ? 'Transferring...' : 'Transfer Shares'}
              </button>
              <button onClick={() => setTransferModal(null)}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {addEntryModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Add Liability Entry — {addEntryModal.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={entryType} onChange={(e) => setEntryType(e.target.value as 'purchase' | 'payment')}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="purchase">Purchase (increases owed)</option>
                  <option value="payment">Payment (reduces outstanding)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD)</label>
                <input type="number" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={entryDesc} onChange={(e) => setEntryDesc(e.target.value)}
                  placeholder={entryType === 'purchase' ? 'Share purchase from...' : 'Cash payment'}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAddEntry} disabled={!entryAmount || createLiabilityMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {createLiabilityMutation.isPending ? 'Saving...' : 'Add Entry'}
              </button>
              <button onClick={() => setAddEntryModal(null)}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editEntry && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Edit Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD)</label>
                <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleEditEntry} disabled={!editAmount || updateLiabilityMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {updateLiabilityMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditEntry(null)}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <LiabilityHistoryModal
          shareholderId={historyModal.id}
          name={historyModal.name}
          onClose={() => setHistoryModal(null)}
          onEdit={(shareholderId, entry) => {
            setEditEntry({ shareholderId, entry });
            setEditAmount((entry.amount / 100).toFixed(2));
            setEditDate(entry.date.slice(0, 10));
            setEditDesc(entry.description);
          }}
          onDelete={handleDeleteEntry}
        />
      )}
    </div>
  );
}

function LiabilityHistoryModal({
  shareholderId, name, onClose, onEdit, onDelete,
}: {
  shareholderId: string;
  name: string;
  onClose: () => void;
  onEdit: (shareholderId: string, entry: ShareLiabilityEntry) => void;
  onDelete: (shareholderId: string, entryId: string) => void;
}) {
  const { data: entries, isLoading } = useShareholderLiabilities(shareholderId);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Liability History — {name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : !entries?.length ? (
          <p className="text-gray-400 text-sm">No liability entries.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                <th className="w-16 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50 group">
                  <td className="px-3 py-2 text-gray-500">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      e.type === 'purchase' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.description}</td>
                  <td className={`px-3 py-2 text-right font-mono ${e.type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
                    {e.type === 'purchase' ? '+' : '-'}{formatMoney(e.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(shareholderId, e)}
                        className="text-gray-400 hover:text-blue-600 p-0.5" title="Edit">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => onDelete(shareholderId, e._id)}
                        className="text-gray-400 hover:text-red-600 p-0.5" title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 text-right">
          <button onClick={onClose} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}
