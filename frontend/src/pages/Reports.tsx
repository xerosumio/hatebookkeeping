import { useState } from 'react';
import { useIncomeStatement } from '../api/hooks';
import { formatMoney } from '../utils/money';

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useIncomeStatement(startDate, endDate);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Income Statement</h1>

      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Revenue */}
          <div>
            <h2 className="text-lg font-semibold text-green-700 mb-3">Revenue</h2>
            {data.income.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {data.income.map((item: any) => (
                    <tr key={item.category} className="border-b border-gray-100">
                      <td className="py-2 capitalize">{item.category.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right text-gray-500">{item.count} txn</td>
                      <td className="py-2 text-right font-mono w-40">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Revenue</td>
                    <td></td>
                    <td className="py-2 text-right font-mono text-green-600">{formatMoney(data.totals.income)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400">No revenue in this period.</p>
            )}
          </div>

          {/* Expenses */}
          <div>
            <h2 className="text-lg font-semibold text-red-700 mb-3">Expenses</h2>
            {data.expenses.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {data.expenses.map((item: any) => (
                    <tr key={item.category} className="border-b border-gray-100">
                      <td className="py-2 capitalize">{item.category.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right text-gray-500">{item.count} txn</td>
                      <td className="py-2 text-right font-mono w-40">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total Expenses</td>
                    <td></td>
                    <td className="py-2 text-right font-mono text-red-600">{formatMoney(data.totals.expense)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400">No expenses in this period.</p>
            )}
          </div>

          {/* Net */}
          <div className="border-t-2 border-gray-300 pt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Net Income</span>
              <span className={`font-mono ${data.totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(data.totals.net)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
