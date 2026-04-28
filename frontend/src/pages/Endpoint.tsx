import { useState } from 'react';
import { useApiTokens, useGenerateToken, useRevokeToken } from '../api/hooks';
import { Plug, Copy, Check, Plus, Trash2, AlertTriangle, ChevronDown, ChevronRight, Key, Globe } from 'lucide-react';

const TOOL_GROUPS = [
  { group: 'Entities', tools: ['list_entities', 'get_entity', 'create_entity', 'update_entity'] },
  { group: 'Clients', tools: ['list_clients', 'get_client', 'create_client', 'update_client', 'delete_client'] },
  { group: 'Quotations', tools: ['list_quotations', 'get_quotation', 'create_quotation', 'update_quotation', 'change_quotation_status', 'approve_quotation', 'reject_quotation'] },
  { group: 'Invoices', tools: ['list_invoices', 'get_invoice', 'create_invoice', 'update_invoice', 'change_invoice_status', 'delete_invoice', 'create_invoice_from_quotation'] },
  { group: 'Receipts', tools: ['list_receipts', 'get_receipt', 'create_receipt', 'delete_receipt'] },
  { group: 'Transactions', tools: ['list_transactions', 'get_transaction', 'create_transaction', 'update_transaction', 'delete_transaction'] },
  { group: 'Payees', tools: ['list_payees', 'create_payee', 'update_payee', 'delete_payee'] },
  { group: 'Expense Approvals', tools: ['list_payment_requests', 'get_payment_request', 'create_payment_request', 'update_payment_request', 'delete_payment_request', 'approve_payment_request', 'reject_payment_request', 'execute_payment_request'] },
  { group: 'Reimbursements', tools: ['list_reimbursements', 'get_reimbursement', 'create_reimbursement', 'update_reimbursement', 'delete_reimbursement'] },
  { group: 'Recurring', tools: ['list_recurring', 'create_recurring', 'update_recurring', 'delete_recurring', 'generate_recurring', 'generate_recurring_invoice'] },
  { group: 'Shareholders', tools: ['list_shareholders', 'get_shareholder', 'create_shareholder', 'update_shareholder', 'transfer_shares', 'record_investment'] },
  { group: 'Monthly Close', tools: ['list_monthly_closes', 'get_monthly_close', 'preview_monthly_close', 'finalize_monthly_close'] },
  { group: 'Funds', tools: ['list_funds', 'create_fund', 'update_fund', 'delete_fund', 'transfer_funds', 'get_fund_transactions'] },
  { group: 'Reports', tools: ['get_cash_flow', 'get_income_statement', 'get_accounts_receivable', 'get_accounts_payable', 'get_balance_sheet', 'get_monthly_summary', 'get_recurring_overview'] },
  { group: 'Users', tools: ['list_users', 'update_user', 'delete_user'] },
  { group: 'Settings', tools: ['get_settings', 'update_settings'] },
  { group: 'Airwallex', tools: ['get_airwallex_status', 'trigger_airwallex_sync', 'get_airwallex_sync_logs', 'list_pending_bank_transactions', 'match_pending_transaction', 'create_from_pending', 'dismiss_pending'] },
];

const totalTools = TOOL_GROUPS.reduce((s, g) => s + g.tools.length, 0);

function buildInstallPrompt(token?: string) {
  const tokenValue = token || '<YOUR_TOKEN>';
  return `You have access to a bookkeeping system called HateBookkeeping via MCP.

To set it up, add this to your MCP configuration (claude_desktop_config.json or .cursor/mcp.json):

{
  "mcpServers": {
    "hatebookkeeping": {
      "command": "node",
      "args": ["<path-to-project>/mcp-server/dist/index.js"],
      "env": {
        "BOOKKEEPING_API_URL": "http://localhost:4000/api",
        "BOOKKEEPING_API_TOKEN": "${tokenValue}"
      }
    }
  }
}

Before using, build the MCP server: cd mcp-server && npm install && npm run build

This gives you ${totalTools} tools across ${TOOL_GROUPS.length} categories to manage clients, quotations, invoices, receipts, transactions, payees, expense approvals, reimbursements, recurring items, shareholders, monthly close, funds, reports, users, settings, and Airwallex bank sync. All actions are attributed to the token owner.`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 p-1">
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      {label && <span className="text-xs">{copied ? 'Copied' : label}</span>}
    </button>
  );
}

interface TokenInfo {
  _id: string;
  name: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function Endpoint() {
  const { data: tokens, isLoading } = useApiTokens();
  const generateMutation = useGenerateToken();
  const revokeMutation = useRevokeToken();

  const [showGenerate, setShowGenerate] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  async function handleGenerate() {
    if (!tokenName.trim()) return;
    const result = await generateMutation.mutateAsync(tokenName.trim());
    setNewlyCreatedToken(result.token);
    setTokenName('');
    setShowGenerate(false);
  }

  function handleRevoke(id: string, name: string) {
    if (confirm(`Revoke token "${name}"? This cannot be undone.`)) {
      revokeMutation.mutate(id);
    }
  }

  const installPrompt = buildInstallPrompt(newlyCreatedToken || undefined);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Plug size={22} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Endpoint</h1>
          <p className="text-sm text-gray-500">Connect Claude or other AI agents to your bookkeeping system</p>
        </div>
      </div>

      {/* API Tokens */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key size={18} className="text-gray-500" />
            API Tokens
          </h2>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={14} /> Generate Token
          </button>
        </div>

        {/* Newly created token banner */}
        {newlyCreatedToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">Copy this token now. It won't be shown again.</p>
            </div>
            <div className="bg-white border border-amber-300 rounded p-3 flex items-center justify-between gap-2">
              <code className="text-sm font-mono text-gray-800 break-all">{newlyCreatedToken}</code>
              <CopyButton text={newlyCreatedToken} label="Copy" />
            </div>
            <button
              onClick={() => setNewlyCreatedToken(null)}
              className="text-xs text-amber-600 hover:underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Generate form */}
        {showGenerate && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. Claude Desktop, Cursor Agent"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button
                onClick={handleGenerate}
                disabled={!tokenName.trim() || generateMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={() => { setShowGenerate(false); setTokenName(''); }}
                className="border border-gray-300 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Token list */}
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : !tokens?.length ? (
          <p className="text-gray-400 text-sm">No API tokens yet. Generate one to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Token</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Used</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tokens.map((t: TokenInfo) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.tokenPreview}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRevoke(t._id, t.name)}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Revoke token"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Install Prompt */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Install Prompt</h2>
          <CopyButton text={installPrompt} label="Copy Prompt" />
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Copy this and paste it to Claude. It will know how to configure and connect to your system.
        </p>
        <div className="bg-gray-900 rounded-lg p-4 max-h-80 overflow-y-auto">
          <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{installPrompt}</pre>
        </div>
      </div>

      {/* Claude Remote Connector */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-purple-600" />
          <h2 className="text-lg font-semibold">Claude Remote Connector</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Connect Claude directly to your bookkeeping system using MCP Streamable HTTP. No local setup required.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remote MCP Server URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono text-gray-800">
                {`${window.location.origin}/api/mcp`}
              </code>
              <CopyButton text={`${window.location.origin}/api/mcp`} label="Copy" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Authentication</label>
            <p className="text-xs text-gray-500 mb-2">
              In Claude's "Add custom connector" dialog, paste the URL above and enter your API token as the <strong>OAuth Client Secret</strong>. Leave Client ID empty.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-900 mb-2">Setup Steps</h3>
            <ol className="text-xs text-purple-800 space-y-1.5 list-decimal list-inside">
              <li>Generate an API token above (if you haven't already)</li>
              <li>Open Claude and go to <strong>Settings &rarr; Connectors &rarr; Add custom connector</strong></li>
              <li>Enter a name (e.g. "HateBookkeeping")</li>
              <li>Paste the Remote MCP Server URL shown above</li>
              <li>Expand "Advanced settings" and paste your API token as the OAuth Client Secret</li>
              <li>Click "Add" — Claude now has access to all {totalTools} bookkeeping tools</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Tool inventory */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Available Tools ({totalTools})</h2>
        <div className="space-y-1">
          {TOOL_GROUPS.map((g) => {
            const isOpen = expandedGroup === g.group;
            return (
              <div key={g.group}>
                <button
                  onClick={() => setExpandedGroup(isOpen ? null : g.group)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <span className="text-sm font-medium">{g.group}</span>
                  </div>
                  <span className="text-xs text-gray-400">{g.tools.length} tools</span>
                </button>
                {isOpen && (
                  <div className="ml-7 mb-2 flex flex-wrap gap-1.5">
                    {g.tools.map((t) => (
                      <span key={t} className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
