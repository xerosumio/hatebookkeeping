import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/money';
import api from '../api/client';
import { useQuery } from '@tanstack/react-query';
import type { Entity } from '../types';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Open' },
  partial: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Partial' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
  finalized: { bg: 'bg-green-50', text: 'text-green-700', label: 'Finalized' },
};

function useGroupSummary(year: number, month?: number) {
  const path = month ? `/monthly-close/summary/${year}/${month}` : `/monthly-close/summary/${year}`;
  return useQuery({
    queryKey: ['monthlyClose', 'summary', year, month],
    queryFn: () => api.get(path).then((r) => r.data),
    enabled: year > 0,
  });
}

export default function MonthlyCloseSummary() {
  const { year: yearStr } = useParams();
  const navigate = useNavigate();
  const [year, setYear] = useState(parseInt(yearStr || String(new Date().getFullYear())));
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const yearSummary = useGroupSummary(year);
  const monthSummary = useGroupSummary(year, selectedMonth || undefined);

  const yearData = yearSummary.data as any;
  const monthData = selectedMonth ? monthSummary.data as any : null;

  return (
    <div className="max-w-5xl">
      <button onClick={() => navigate('/monthly-close')} className="text-sm text-blue-600 hover:underline mb-4">
        &larr; Back to Monthly Close
      </button>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AWATO Group Summary</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setYear(year - 1); setSelectedMonth(null); }} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&larr;</button>
          <span className="text-sm font-medium">{year}</span>
          <button onClick={() => { setYear(year + 1); setSelectedMonth(null); }} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">&rarr;</button>
        </div>
      </div>

      {/* Year overview table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Income</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Expense</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(yearData?.months || []).map((m: any) => {
              const badge = STATUS_BADGES[m.status] || STATUS_BADGES.open;
              const isSelected = selectedMonth === m.month;
              return (
                <tr
                  key={m.month}
                  className={`cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedMonth(m.month)}
                >
                  <td className="px-4 py-3 font-medium">{MONTH_SHORT[m.month]}</td>
                  <td className="px-4 py-3 text-right font-mono">{m.totalIncome ? formatMoney(m.totalIncome) : '--'}</td>
                  <td className="px-4 py-3 text-right font-mono">{m.totalExpense ? formatMoney(m.totalExpense) : '--'}</td>
                  <td className={`px-4 py-3 text-right font-mono ${m.netProfit < 0 ? 'text-red-600' : m.netProfit > 0 ? 'text-green-600' : ''}`}>
                    {m.totalIncome || m.totalExpense ? formatMoney(m.netProfit) : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected month detail */}
      {selectedMonth && monthData && (
        <div>
          <h2 className="text-xl font-bold mb-4">{MONTH_NAMES[selectedMonth]} {year} -- Group Close</h2>

          {/* Group totals */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500">Opening Cash</div>
              <div className="text-lg font-bold font-mono">{formatMoney(monthData.openingCash || 0)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500">Total Income</div>
              <div className="text-lg font-bold font-mono text-green-600">+{formatMoney(monthData.totalIncome)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500">Total Expenses</div>
              <div className="text-lg font-bold font-mono text-red-600">-{formatMoney(monthData.totalExpense)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500">Net P&L</div>
              <div className={`text-lg font-bold font-mono ${monthData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatMoney(monthData.netProfit)}
              </div>
            </div>
            <div className={`border rounded-lg p-4 ${monthData.availableCash >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs text-gray-600">Available Cash</div>
              <div className={`text-lg font-bold font-mono ${monthData.availableCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatMoney(monthData.availableCash)}
              </div>
            </div>
          </div>

          {/* Split */}
          {!monthData.isLoss && monthData.availableCash > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-600">Shareholder Distribution (75%)</div>
                <div className="text-lg font-bold font-mono">{formatMoney(monthData.shareholderDistribution)}</div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-xs text-teal-600">Staff Reserve (5%)</div>
                <div className="text-lg font-bold font-mono">{formatMoney(monthData.staffReserve)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500">Closing Cash / Next Month Opening (20%)</div>
                <div className="text-lg font-bold font-mono">{formatMoney(monthData.companyReserve)}</div>
              </div>
            </div>
          )}

          {/* Per-entity breakdown */}
          <h3 className="text-lg font-semibold mb-3">Entity Breakdown</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {(monthData.entities || []).map((e: any) => {
              const ent = e.entity as Entity;
              const sBadge = STATUS_BADGES[e.status] || STATUS_BADGES.open;
              return (
                <div
                  key={ent?._id || ''}
                  className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300"
                  onClick={() => navigate(`/monthly-close/${ent?._id}/${year}/${selectedMonth}`)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold">{ent?.code} -- {ent?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${sBadge.bg} ${sBadge.text}`}>{sBadge.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Income: </span>
                      <span className="font-mono text-green-600">{formatMoney(e.totalIncome)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expense: </span>
                      <span className="font-mono text-red-600">{formatMoney(e.totalExpense)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Net: </span>
                      <span className={`font-mono ${e.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(e.netProfit)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Available: </span>
                      <span className={`font-mono ${e.availableCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(e.availableCash)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Aggregated shareholder distributions */}
          {(monthData.distributions || []).length > 0 && (
            <>
              <h3 className="text-lg font-semibold mb-3">
                {monthData.isLoss ? 'Total Collection per Shareholder' : 'Total Distribution per Shareholder'}
              </h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Shareholder</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Share %</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthData.distributions.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{d.name}</td>
                        <td className="px-4 py-3 text-right font-mono">{d.sharePercent.toFixed(2)}%</td>
                        <td className={`px-4 py-3 text-right font-mono ${d.total < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {d.total < 0 ? '-' : ''}{formatMoney(Math.abs(d.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
