import { useParams, useNavigate } from 'react-router-dom';
import { useShareholder } from '../api/hooks';
import type { ShareAdjustmentLog } from '../types';
import { formatMoney } from '../utils/money';

const TYPE_LABELS: Record<string, string> = {
  investment: 'Investment',
  distribution: 'Distribution',
  collection: 'Collection',
  adjustment: 'Adjustment',
};

const TYPE_COLORS: Record<string, string> = {
  investment: 'bg-green-50 text-green-700',
  distribution: 'bg-blue-50 text-blue-700',
  collection: 'bg-amber-50 text-amber-700',
  adjustment: 'bg-gray-50 text-gray-700',
};

export default function ShareholderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useShareholder(id || '');

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-gray-500">Shareholder not found</p>;

  const { shareholder, transactions } = data;
  const currentEquity = transactions[0]?.balanceAfter ?? 0;

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/shareholders')} className="text-sm text-blue-600 hover:underline mb-4">
        &larr; Back to Shareholders
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{shareholder.name}</h1>
          <div className="text-sm text-gray-500 mt-1">
            Share: {shareholder.sharePercent.toFixed(2)}%
            {typeof shareholder.user === 'object' && ` | ${shareholder.user.email}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Current Equity</div>
          <div className="text-2xl font-bold font-mono">{formatMoney(currentEquity)}</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Equity Transactions</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((txn) => (
              <tr key={txn._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(txn.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[txn.type]}`}>
                    {TYPE_LABELS[txn.type]}
                  </span>
                </td>
                <td className="px-4 py-3">{txn.description}</td>
                <td className={`px-4 py-3 text-right font-mono ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.amount >= 0 ? '+' : ''}{formatMoney(txn.amount)}
                </td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(txn.balanceAfter)}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No transactions yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shareholder.shareHistory && shareholder.shareHistory.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Share Adjustment History</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">From</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Changed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...shareholder.shareHistory].reverse().map((entry: ShareAdjustmentLog, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-mono">{entry.previousPercent.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{entry.newPercent.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-gray-600">{entry.reason || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {typeof entry.changedBy === 'object' ? entry.changedBy.name : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
