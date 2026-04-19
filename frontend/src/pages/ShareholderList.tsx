import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShareholders, useInvestShareholder } from '../api/hooks';
import { formatMoney } from '../utils/money';

export default function ShareholderList() {
  const navigate = useNavigate();
  const { data: shareholders, isLoading } = useShareholders();
  const investMutation = useInvestShareholder();

  const [investModal, setInvestModal] = useState<{ id: string; name: string } | null>(null);
  const [investAmount, setInvestAmount] = useState('');
  const [investDate, setInvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [investDesc, setInvestDesc] = useState('');

  const totalEquity = shareholders?.reduce((sum, s) => sum + (s.currentEquity || 0), 0) || 0;
  const totalInvested = shareholders?.reduce((sum, s) => sum + (s.totalInvested || 0), 0) || 0;

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
          <div className="text-sm text-gray-500">Shareholders</div>
          <div className="text-xl font-bold">{shareholders?.length || 0}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Share %</th>
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
                <td className="px-4 py-3 text-right font-mono">{formatMoney(sh.totalInvested || 0)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(sh.currentEquity || 0)}</td>
                <td className="px-4 py-3 text-right">
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

      {investModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Record Investment — {investModal.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={investDate}
                  onChange={(e) => setInvestDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={investDesc}
                  onChange={(e) => setInvestDesc(e.target.value)}
                  placeholder="Capital investment"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleInvest}
                disabled={!investAmount || investMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {investMutation.isPending ? 'Saving...' : 'Record Investment'}
              </button>
              <button
                onClick={() => setInvestModal(null)}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
