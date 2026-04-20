import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAirwallexStatus, useAirwallexSyncLogs, useTriggerSync, usePendingBankTransactions } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { FUND_NAMES, ENTITY_LABELS } from '../utils/bankAccounts';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Loader2, ChevronDown, ChevronUp, ExternalLink, Search, History, Settings, ArrowRight } from 'lucide-react';
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
  fundId: string | null;
}

interface PendingItem {
  _id: string;
  entity: 'ax' | 'nt';
  type: 'income' | 'expense';
  amount: number;
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

function SyncStatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={12} /> Success</span>;
  }
  if (status === 'error') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Error</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"><Loader2 size={12} className="animate-spin" /> Running</span>;
}

function DiscrepancyActions({
  entityKey, discrepancy, pendingItems, fundId, onSync, isSyncing,
}: {
  entityKey: string;
  discrepancy: number;
  pendingItems: PendingItem[];
  fundId: string | null;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const entityPending = pendingItems.filter((p) => p.entity === entityKey);
  const pendingExpenseTotal = entityPending.filter((p) => p.type === 'expense').reduce((s, p) => s + p.amount, 0);
  const pendingIncomeTotal = entityPending.filter((p) => p.type === 'income').reduce((s, p) => s + p.amount, 0);
  const pendingNetEffect = pendingIncomeTotal - pendingExpenseTotal;
  const pendingMatchesDiscrepancy = entityPending.length > 0 && Math.abs(discrepancy + pendingNetEffect) < 2;

  return (
    <div className="mt-3 border border-red-200 bg-red-50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>Discrepancy of {formatMoney(discrepancy)} detected</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-xs text-red-700 space-y-1.5 bg-white/60 rounded p-3">
            {discrepancy < 0 ? (
              <p>The bank balance is <strong>lower</strong> than the system by {formatMoney(Math.abs(discrepancy))}. This typically means expenses on the bank side have not been recorded in the system yet.</p>
            ) : (
              <p>The bank balance is <strong>higher</strong> than the system by {formatMoney(discrepancy)}. This typically means income received at the bank has not been recorded in the system yet.</p>
            )}
            {entityPending.length > 0 && (
              <p className="mt-1">
                There are <strong>{entityPending.length} pending bank transaction{entityPending.length !== 1 ? 's' : ''}</strong> for {ENTITY_LABELS[entityKey]} that have not been booked.
                {pendingExpenseTotal > 0 && <span> Pending expenses: <strong>{formatMoney(pendingExpenseTotal)}</strong>.</span>}
                {pendingIncomeTotal > 0 && <span> Pending income: <strong>{formatMoney(pendingIncomeTotal)}</strong>.</span>}
              </p>
            )}
            {pendingMatchesDiscrepancy && (
              <p className="text-green-700 font-medium mt-1">
                Resolving all pending transactions would fix this discrepancy.
              </p>
            )}
          </div>

          <div className="text-xs font-medium text-red-800 mb-1">Action Checklist</div>
          <div className="space-y-1.5">
            <a
              href="#pending-review"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('pending-review')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded border border-red-100 text-sm text-gray-700 hover:bg-red-50 transition-colors"
            >
              <Search size={13} className="text-red-500 shrink-0" />
              <span className="flex-1">Review pending bank transactions</span>
              {entityPending.length > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{entityPending.length}</span>
              )}
              <ArrowRight size={12} className="text-gray-400" />
            </a>

            <button
              onClick={onSync}
              disabled={isSyncing}
              className="w-full flex items-center gap-2 px-3 py-2 bg-white rounded border border-red-100 text-sm text-gray-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={13} className="text-red-500 shrink-0 animate-spin" /> : <RefreshCw size={13} className="text-red-500 shrink-0" />}
              <span className="flex-1 text-left">{isSyncing ? 'Syncing...' : 'Re-sync from Airwallex'}</span>
              <ArrowRight size={12} className="text-gray-400" />
            </button>

            <Link
              to="/transactions"
              className="flex items-center gap-2 px-3 py-2 bg-white rounded border border-red-100 text-sm text-gray-700 hover:bg-red-50 transition-colors"
            >
              <ExternalLink size={13} className="text-red-500 shrink-0" />
              <span className="flex-1">Check transactions for missing entries</span>
              <ArrowRight size={12} className="text-gray-400" />
            </Link>

            {fundId && (
              <Link
                to={`/funds/${fundId}`}
                className="flex items-center gap-2 px-3 py-2 bg-white rounded border border-red-100 text-sm text-gray-700 hover:bg-red-50 transition-colors"
              >
                <History size={13} className="text-red-500 shrink-0" />
                <span className="flex-1">View {FUND_NAMES[entityKey] || 'fund'} history</span>
                <ArrowRight size={12} className="text-gray-400" />
              </Link>
            )}

            <Link
              to="/funds"
              className="flex items-center gap-2 px-3 py-2 bg-white rounded border border-red-100 text-sm text-gray-700 hover:bg-red-50 transition-colors"
            >
              <Settings size={13} className="text-red-500 shrink-0" />
              <span className="flex-1">Manually adjust fund balance</span>
              <ArrowRight size={12} className="text-gray-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function EntityCard({ entityKey, data, onSync, isSyncing, pendingItems }: { entityKey: string; data: EntityStatus; onSync: () => void; isSyncing: boolean; pendingItems: PendingItem[] }) {
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

      {discrepancy !== null && discrepancy !== 0 && (
        <DiscrepancyActions
          entityKey={entityKey}
          discrepancy={discrepancy}
          pendingItems={pendingItems}
          fundId={data.fundId}
          onSync={onSync}
          isSyncing={isSyncing}
        />
      )}
    </div>
  );
}

export default function AirwallexSync() {
  const { data: status, isLoading: statusLoading } = useAirwallexStatus();
  const { data: logs, isLoading: logsLoading } = useAirwallexSyncLogs(30);
  const triggerSync = useTriggerSync();
  const { data: pendingItems } = usePendingBankTransactions();

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
            pendingItems={(pendingItems as PendingItem[]) || []}
          />
          <EntityCard
            entityKey="nt"
            data={status.nt}
            onSync={() => triggerSync.mutate('nt')}
            isSyncing={triggerSync.isPending && triggerSync.variables === 'nt'}
            pendingItems={(pendingItems as PendingItem[]) || []}
          />
        </div>
      ) : null}

      <div id="pending-review" className="mb-8">
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
