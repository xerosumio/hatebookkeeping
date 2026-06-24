import { useAirwallexStatus } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { ENTITY_LABELS } from '../utils/bankAccounts';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface TokenInfo {
  authenticated: boolean;
  expiresAt: number | null;
}

interface EntityStatus {
  token: TokenInfo;
  bankBalance: number | null;
}

function relativeTime(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Expired';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Less than 1 min';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function TokenBadge({ token }: { token: TokenInfo }) {
  if (!token.expiresAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        <Clock size={12} /> Not connected
      </span>
    );
  }
  const remaining = token.expiresAt - Date.now();
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={12} /> Expired
      </span>
    );
  }
  if (remaining < 5 * 60_000) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle size={12} /> Expires in {relativeTime(token.expiresAt)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle size={12} /> Valid — {relativeTime(token.expiresAt)}
    </span>
  );
}

function EntityCard({ entityKey, data }: { entityKey: string; data: EntityStatus }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{ENTITY_LABELS[entityKey] || entityKey.toUpperCase()}</h2>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">API Token</div>
          <TokenBadge token={data.token} />
        </div>

        <div>
          <div className="text-xs text-gray-500">Bank Balance (HKD)</div>
          <div className="text-2xl font-mono font-semibold mt-1">
            {data.bankBalance !== null ? formatMoney(data.bankBalance) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AirwallexSync() {
  const { data: status, isLoading: statusLoading } = useAirwallexStatus();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['airwallex-status'] });
    setRefreshing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bank Balance</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing || statusLoading}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {refreshing ? 'Refreshing...' : 'Refresh Balance'}
        </button>
      </div>

      {statusLoading ? (
        <p className="text-gray-500">Loading balances...</p>
      ) : status ? (
        <div className="grid grid-cols-2 gap-4">
          <EntityCard entityKey="ax" data={status.ax} />
          <EntityCard entityKey="nt" data={status.nt} />
        </div>
      ) : null}
    </div>
  );
}
