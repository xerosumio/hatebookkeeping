import { useParams, Link } from 'react-router-dom';
import { useFunds, useFundTransactions } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { ArrowLeft } from 'lucide-react';
import type { FundLedgerEntry } from '../types';

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

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: funds } = useFunds();
  const fund = funds?.find((f) => f._id === id);
  const { data: ledger, isLoading } = useFundTransactions(id || '');
  const entries = ledger?.entries ?? [];

  if (!fund) {
    return (
      <div>
        <Link to="/funds" className="text-blue-600 hover:underline text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Back to Funds
        </Link>
        <p className="text-gray-500">Fund not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/funds" className="text-blue-600 hover:underline text-sm flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to Funds
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{fund.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded ${typeColors[fund.type]}`}>{typeLabels[fund.type]}</span>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Current Balance</div>
          <div className={`text-2xl font-bold font-mono ${fund.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(fund.balance)}
          </div>
          {ledger && (
            <div className="text-xs text-gray-400 mt-0.5">Opening: {formatMoney(ledger.openingBalance)}</div>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-700 mb-3">Transaction History</h2>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : entries.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e: FundLedgerEntry) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{e.description}</div>
                    <div className="text-xs text-gray-400">{e.direction}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                      e.type === 'transfer' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {e.type === 'transfer' ? 'Transfer' : 'Transaction'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${e.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {e.amount >= 0 ? '+' : '-'}{formatMoney(Math.abs(e.amount))}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${e.runningBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    {formatMoney(e.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">No transactions yet.</p>
      )}
    </div>
  );
}
