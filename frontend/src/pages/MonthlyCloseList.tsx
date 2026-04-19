import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMonthlyCloses } from '../api/hooks';
import { formatMoney } from '../utils/money';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyCloseList() {
  const navigate = useNavigate();
  const { data: closes, isLoading } = useMonthlyCloses();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const filtered = closes?.filter((c) => c.year === year) || [];

  // Show all 12 months for the selected year
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const existing = filtered.find((c) => c.month === month);
    return { month, data: existing };
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Monthly Close</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(year - 1)} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&larr;</button>
          <span className="text-sm font-medium">{year}</span>
          <button onClick={() => setYear(year + 1)} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&rarr;</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Income</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Expense</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {months.map(({ month, data: d }) => (
              <tr key={month} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{MONTH_NAMES[month]} {year}</td>
                <td className="px-4 py-3 text-right font-mono">{d ? formatMoney(d.totalIncome) : '—'}</td>
                <td className="px-4 py-3 text-right font-mono">{d ? formatMoney(d.totalExpense) : '—'}</td>
                <td className={`px-4 py-3 text-right font-mono ${d && d.netProfit < 0 ? 'text-red-600' : d && d.netProfit > 0 ? 'text-green-600' : ''}`}>
                  {d ? formatMoney(d.netProfit) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {d?.status === 'finalized' ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Finalized</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Open</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/monthly-close/${year}/${month}`)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {d?.status === 'finalized' ? 'View' : 'Review'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
