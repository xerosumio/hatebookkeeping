import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMonthlyClose, useFinalizeMonthlyClose, useCreateCollectionRequests } from '../api/hooks';
import { formatMoney } from '../utils/money';
import type { Entity } from '../types';

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthlyCloseDetail() {
  const { entity: entityId, year: yearStr, month: monthStr } = useParams();
  const navigate = useNavigate();
  const year = parseInt(yearStr || '0');
  const month = parseInt(monthStr || '0');

  const { data, isLoading, refetch } = useMonthlyClose(entityId || '', year, month);
  const finalizeMutation = useFinalizeMonthlyClose();
  const collectionMutation = useCreateCollectionRequests();
  const [notes, setNotes] = useState('');

  async function handleFinalize() {
    if (!entityId) return;
    if (!confirm(`Finalize ${MONTH_NAMES[month]} ${year}? This will create equity transactions for all shareholders.`)) return;
    await finalizeMutation.mutateAsync({ entity: entityId, year, month, notes });
    refetch();
  }

  async function handleCreateCollections() {
    if (!entityId) return;
    if (!confirm('Create payment requests to collect from shareholders?')) return;
    await collectionMutation.mutateAsync({ entity: entityId, year, month });
    alert('Collection payment requests created.');
  }

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-gray-500">No data</p>;

  const isFinalized = data.status === 'finalized';
  const entityName = data.entity && typeof data.entity === 'object' ? (data.entity as Entity).name : '';
  const entityCode = data.entity && typeof data.entity === 'object' ? (data.entity as Entity).code : '';

  return (
    <div>
      <button onClick={() => navigate('/monthly-close')} className="text-sm text-blue-600 hover:underline mb-4">
        &larr; Back to Monthly Close
      </button>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{MONTH_NAMES[month]} {year}</h1>
          {entityCode && <span className="text-sm text-gray-500 mr-2">{entityCode} — {entityName}</span>}
          <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${isFinalized ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {isFinalized ? 'Finalized' : 'Draft Preview'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Income</div>
          <div className="text-xl font-bold font-mono text-green-600">{formatMoney(data.totalIncome)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Expense</div>
          <div className="text-xl font-bold font-mono text-red-600">{formatMoney(data.totalExpense)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Net {data.isLoss ? 'Loss' : 'Profit'}</div>
          <div className={`text-xl font-bold font-mono ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(data.netProfit)}
          </div>
        </div>
      </div>

      {!data.isLoss && data.netProfit > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600">Shareholder Distribution (75%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.shareholderDistribution)}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600">Company Reserve (20%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.companyReserve)}</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="text-sm text-teal-600">Staff Reserve (5%)</div>
            <div className="text-lg font-bold font-mono">{formatMoney(data.staffReserve)}</div>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">
        {data.isLoss ? 'Collection from Shareholders' : 'Distribution to Shareholders'}
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Shareholder</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Share %</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.distributions.map((d, i) => {
              const name = typeof d.shareholder === 'object' ? d.shareholder.name : d.shareholder;
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3 text-right font-mono">{d.sharePercent.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-right font-mono ${data.isLoss ? 'text-red-600' : 'text-green-600'}`}>
                    {formatMoney(Math.abs(d.amount))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isFinalized && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Any notes about this month's close..."
            />
          </div>
          <button
            onClick={handleFinalize}
            disabled={finalizeMutation.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {finalizeMutation.isPending ? 'Finalizing...' : 'Finalize Month'}
          </button>
        </div>
      )}

      {isFinalized && data.isLoss && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700 mb-3">
            This month had a loss. You can create payment requests to collect from shareholders.
          </p>
          <button
            onClick={handleCreateCollections}
            disabled={collectionMutation.isPending}
            className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {collectionMutation.isPending ? 'Creating...' : 'Create Collection Requests'}
          </button>
        </div>
      )}

      {isFinalized && data.closedBy && (
        <div className="mt-4 text-xs text-gray-400">
          Closed by {typeof data.closedBy === 'object' ? data.closedBy.name : data.closedBy}
          {data.closedAt && ` on ${new Date(data.closedAt).toLocaleString()}`}
          {data.notes && ` — ${data.notes}`}
        </div>
      )}
    </div>
  );
}
