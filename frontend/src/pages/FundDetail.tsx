import { useParams, Link } from 'react-router-dom';
import { useFunds, useFundTransactions, useMonthlyCloses } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { ArrowLeft } from 'lucide-react';
import type { Entity, MonthlyClose, FundLedgerEntry } from '../types';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

  const entityId = fund?.entity && typeof fund.entity === 'object' ? (fund.entity as Entity)._id : (fund?.entity || '');
  const { data: monthlyCloses } = useMonthlyCloses(fund?.type === 'bank' ? entityId : undefined);

  const finalizedCloses = (monthlyCloses || [])
    .filter((c: MonthlyClose) => c.status === 'finalized')
    .sort((a: MonthlyClose, b: MonthlyClose) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

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

      {fund.type === 'bank' && finalizedCloses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Monthly Close History</h2>
          <div className="space-y-3">
            {finalizedCloses.map((c: MonthlyClose) => (
              <div key={`${c.year}-${c.month}`} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">{MONTH_NAMES[c.month]} {c.year}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Finalized</span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-sm mb-3">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Opening Cash</div>
                    <div className="font-mono font-medium">{formatMoney(c.openingCash)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Income</div>
                    <div className="font-mono font-medium text-green-600">+{formatMoney(c.totalIncome)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Expenses</div>
                    <div className="font-mono font-medium text-red-600">-{formatMoney(c.totalExpense)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500">Net P&L</div>
                    <div className={`font-mono font-medium ${c.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(c.netProfit)}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-xs text-blue-600">Available Cash</div>
                    <div className="font-mono font-bold">{formatMoney(c.availableCash)}</div>
                  </div>
                </div>
                {!c.isLoss && c.availableCash > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs text-gray-500 mb-2">Distribution Split</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex justify-between items-center bg-blue-50 rounded px-3 py-2">
                        <span className="text-xs text-blue-700">75% Shareholders</span>
                        <span className="font-mono text-blue-800">{formatMoney(c.shareholderDistribution)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-teal-50 rounded px-3 py-2">
                        <span className="text-xs text-teal-700">5% Staff Reserve</span>
                        <span className="font-mono text-teal-800">{formatMoney(c.staffReserve)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-100 rounded px-3 py-2">
                        <span className="text-xs text-gray-600">20% Closing Cash</span>
                        <span className="font-mono text-gray-800">{formatMoney(c.closingCash)}</span>
                      </div>
                    </div>
                  </div>
                )}
                {c.isLoss && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs text-red-500">Loss month — shareholders required to inject funds</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
