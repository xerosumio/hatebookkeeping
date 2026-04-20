import { useAirwallexStatus, useAirwallexSyncLogs, useTriggerSync } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import PendingBankTransactions from '../components/PendingBankTransactions';

interface TokenInfo {
  authenticated: boolean;
  expiresAt: number | null;
}

interface SyncLog {
  _id: string;
  entity: 'ax' | 'nt';
  status: 'running' | 'success' | 'error';
  startedAt: string;
  completedAt?: string;
  bankBalance?: number;
  systemBalance?: number;
  discrepancy?: number;
  matched: number;
  created: number;
  unmatched: number;
  error?: string;
}

interface EntityStatus {
  token: TokenInfo;
  lastSync: SyncLog | null;
  systemBalance: number;
  bankBalance: number | null;
}

const ENTITY_LABELS: Record<string, string> = { ax: 'Axilogy', nt: 'Naton' };

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

function SyncStatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={12} /> Success</span>;
  }
  if (status === 'error') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Error</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"><Loader2 size={12} className="animate-spin" /> Running</span>;
}

function EntityCard({ entityKey, data, onSync, isSyncing }: { entityKey: string; data: EntityStatus; onSync: () => void; isSyncing: boolean }) {
  const discrepancy = data.bankBalance !== null ? data.bankBalance - data.systemBalance : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{ENTITY_LABELS[entityKey] || entityKey.toUpperCase()}</h2>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">API Token</div>
          <TokenBadge token={data.token} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-500">Bank Balance</div>
            <div className="text-sm font-mono font-medium">
              {data.bankBalance !== null ? formatMoney(data.bankBalance) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">System Balance</div>
            <div className="text-sm font-mono font-medium">{formatMoney(data.systemBalance)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Discrepancy</div>
            <div className={`text-sm font-mono font-medium ${discrepancy === 0 ? 'text-green-600' : discrepancy !== null ? 'text-red-600' : ''}`}>
              {discrepancy !== null ? formatMoney(discrepancy) : '—'}
            </div>
          </div>
        </div>

        {data.lastSync && (
          <div className="border-t border-gray-100 pt-2">
            <div className="text-xs text-gray-500 mb-1">Last Sync</div>
            <div className="flex items-center gap-2 text-sm">
              <SyncStatusBadge status={data.lastSync.status} />
              <span className="text-gray-500">
                {new Date(data.lastSync.startedAt).toLocaleString()}
              </span>
              {data.lastSync.status === 'success' && (
                <span className="text-xs text-gray-400">
                  {data.lastSync.matched} matched, {data.lastSync.unmatched} unmatched
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AirwallexSync() {
  const { data: status, isLoading: statusLoading } = useAirwallexStatus();
  const { data: logs, isLoading: logsLoading } = useAirwallexSyncLogs(30);
  const triggerSync = useTriggerSync();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Airwallex Sync</h1>
      </div>

      {statusLoading ? (
        <p className="text-gray-500">Loading status...</p>
      ) : status ? (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <EntityCard
            entityKey="ax"
            data={status.ax}
            onSync={() => triggerSync.mutate('ax')}
            isSyncing={triggerSync.isPending && triggerSync.variables === 'ax'}
          />
          <EntityCard
            entityKey="nt"
            data={status.nt}
            onSync={() => triggerSync.mutate('nt')}
            isSyncing={triggerSync.isPending && triggerSync.variables === 'nt'}
          />
        </div>
      ) : null}

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Pending Review</h2>
        <PendingBankTransactions />
      </div>

      <h2 className="text-lg font-semibold mb-3">Sync History</h2>
      {logsLoading ? (
        <p className="text-gray-500">Loading logs...</p>
      ) : !logs?.length ? (
        <p className="text-gray-500">No sync logs yet. Trigger a sync to start.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Matched</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Unmatched</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Discrepancy</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Error</th>
              </tr>
            </thead>
            <tbody>
              {(logs as SyncLog[]).map((log) => {
                const duration = log.completedAt
                  ? `${((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000).toFixed(1)}s`
                  : '—';
                return (
                  <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {ENTITY_LABELS[log.entity] || log.entity.toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <SyncStatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{log.matched}</td>
                    <td className={`px-4 py-3 text-right font-mono ${log.unmatched > 0 ? 'text-amber-600 font-medium' : ''}`}>
                      {log.unmatched}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${log.discrepancy && log.discrepancy !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {log.discrepancy !== undefined ? formatMoney(log.discrepancy) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{duration}</td>
                    <td className="px-4 py-3 text-red-500 text-xs truncate max-w-[200px]">
                      {log.error || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
