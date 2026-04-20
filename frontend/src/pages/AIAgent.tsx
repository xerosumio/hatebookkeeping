import { useState } from 'react';
import { Bot, Copy, Check, Terminal, Key, Globe, ChevronDown, ChevronRight } from 'lucide-react';

const TOOL_GROUPS = [
  { group: 'Auth', tools: ['get_current_user'] },
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
  { group: 'Shareholders', tools: ['list_shareholders', 'get_shareholder', 'create_shareholder', 'update_shareholder', 'transfer_shares', 'record_investment', 'list_shareholder_liabilities', 'add_shareholder_liability', 'update_shareholder_liability', 'delete_shareholder_liability'] },
  { group: 'Monthly Close', tools: ['list_monthly_closes', 'get_monthly_close', 'preview_monthly_close', 'finalize_monthly_close'] },
  { group: 'Funds', tools: ['list_funds', 'create_fund', 'update_fund', 'delete_fund', 'transfer_funds', 'get_fund_transactions'] },
  { group: 'Reports', tools: ['get_cash_flow', 'get_income_statement', 'get_accounts_receivable', 'get_accounts_payable', 'get_balance_sheet', 'get_monthly_summary', 'get_recurring_overview'] },
  { group: 'Users', tools: ['list_users', 'update_user', 'delete_user'] },
  { group: 'Settings', tools: ['get_settings', 'update_settings'] },
  { group: 'Airwallex', tools: ['get_airwallex_status', 'trigger_airwallex_sync', 'get_airwallex_sync_logs', 'list_pending_bank_transactions', 'match_pending_transaction', 'create_from_pending', 'dismiss_pending'] },
];

const totalTools = TOOL_GROUPS.reduce((s, g) => s + g.tools.length, 0);

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "hatebookkeeping": {
      "command": "node",
      "args": ["<path-to-project>/mcp-server/dist/index.js"],
      "env": {
        "BOOKKEEPING_API_URL": "http://localhost:4000/api",
        "BOOKKEEPING_EMAIL": "your-admin@email.com",
        "BOOKKEEPING_PASSWORD": "your-password"
      }
    }
  }
}`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "hatebookkeeping": {
      "command": "node",
      "args": ["<path-to-project>/mcp-server/dist/index.js"],
      "env": {
        "BOOKKEEPING_API_URL": "http://localhost:4000/api",
        "BOOKKEEPING_EMAIL": "your-admin@email.com",
        "BOOKKEEPING_PASSWORD": "your-password"
      }
    }
  }
}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600 p-1">
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

export default function AIAgent() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Bot size={22} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Agent Integration</h1>
          <p className="text-sm text-gray-500">Connect Claude or other AI agents to manage your bookkeeping</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Protocol</div>
          <div className="text-lg font-bold">MCP</div>
          <div className="text-xs text-gray-400">Model Context Protocol</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Transport</div>
          <div className="text-lg font-bold">stdio</div>
          <div className="text-xs text-gray-400">Standard I/O pipe</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Available Tools</div>
          <div className="text-lg font-bold">{totalTools}</div>
          <div className="text-xs text-gray-400">{TOOL_GROUPS.length} groups</div>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Terminal size={18} className="text-gray-500" />
          Setup Instructions
        </h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">1. Build the MCP server</h3>
            <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
              <code className="text-sm text-green-400 font-mono">cd mcp-server && npm install && npm run build</code>
              <CopyButton text="cd mcp-server && npm install && npm run build" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Key size={14} className="text-gray-400" />
              2. Environment variables
            </h3>
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm space-y-1">
              <div><span className="font-mono text-blue-600">BOOKKEEPING_API_URL</span> — Backend API URL (default: <code className="text-gray-600">http://localhost:4000/api</code>)</div>
              <div><span className="font-mono text-blue-600">BOOKKEEPING_EMAIL</span> — Admin user email for authentication</div>
              <div><span className="font-mono text-blue-600">BOOKKEEPING_PASSWORD</span> — Admin user password</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Globe size={14} className="text-gray-400" />
              3. Add to Claude Desktop
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Add this to your <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code>:
            </p>
            <div className="bg-gray-900 rounded-lg p-3 relative">
              <pre className="text-sm text-green-400 font-mono overflow-x-auto">{CLAUDE_CONFIG}</pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={CLAUDE_CONFIG} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">4. Or add to Cursor</h3>
            <p className="text-xs text-gray-500 mb-2">
              Add this to your <code className="bg-gray-100 px-1 rounded">.cursor/mcp.json</code> in the project root:
            </p>
            <div className="bg-gray-900 rounded-lg p-3 relative">
              <pre className="text-sm text-green-400 font-mono overflow-x-auto">{CURSOR_CONFIG}</pre>
              <div className="absolute top-2 right-2">
                <CopyButton text={CURSOR_CONFIG} />
              </div>
            </div>
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
