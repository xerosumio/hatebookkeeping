import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMonthlyCloses, useEntities } from '../api/hooks';
import { formatMoney } from '../utils/money';
import type { Entity } from '../types';

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyCloseList() {
  const navigate = useNavigate();
  const { data: entities } = useEntities();
  const [entityFilter, setEntityFilter] = useState('');
  const { data: closes, isLoading } = useMonthlyCloses(entityFilter || undefined);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const filtered = closes?.filter((c) => c.year === year) || [];

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
        <div className="flex items-center gap-4">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Entities</option>
            {entities?.map((ent: Entity) => (
              <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(year - 1)} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&larr;</button>
            <span className="text-sm font-medium">{year}</span>
            <button onClick={() => setYear(year + 1)} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&rarr;</button>
          </div>
        </div>
      </div>

      {!entityFilter && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Select an entity to view or finalize monthly close. The table below shows all entities combined.
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
              {!entityFilter && <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>}
              <th className="text-right px-4 py-3 font-medium text-gray-600">Income</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Expense</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entityFilter ? (
              months.map(({ month, data: d }) => (
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
                      onClick={() => navigate(`/monthly-close/${entityFilter}/${year}/${month}`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {d?.status === 'finalized' ? 'View' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              filtered.length > 0 ? (
                filtered.map((d) => {
                  const entObj = d.entity && typeof d.entity === 'object' ? d.entity as Entity : null;
                  const entityId = typeof d.entity === 'string' ? d.entity : entObj?._id || '';
                  return (
                    <tr key={d._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{MONTH_NAMES[d.month]} {year}</td>
                      <td className="px-4 py-3 text-gray-500">{entObj?.code || ''}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(d.totalIncome)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatMoney(d.totalExpense)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${d.netProfit < 0 ? 'text-red-600' : d.netProfit > 0 ? 'text-green-600' : ''}`}>
                        {formatMoney(d.netProfit)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.status === 'finalized' ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">Finalized</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Open</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/monthly-close/${entityId}/${year}/${d.month}`)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {d.status === 'finalized' ? 'View' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No finalized closes for {year}. Select an entity to review and finalize.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
