import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useIncomeStatement, useIncomeStatementTransactions,
  useCashFlow, useAccountsReceivable, useAccountsPayable, useEntities,
  useBalanceSheet, useMonthlySummary,
} from '../api/hooks';
import { formatMoney } from '../utils/money';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { IncomeStatementLine, CashFlowMonth, ARInvoice, APPaymentRequest, APCategoryBreakdown, Transaction, Entity } from '../types';

const tabs = ['Income Statement', 'Balance Sheet', 'Monthly Summary', 'Cash Flow', 'Accounts Receivable', 'Accounts Payable'] as const;
type Tab = (typeof tabs)[number];
type DateMode = 'all' | 'month' | 'custom';

const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function localDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthStart() { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)); }
function monthEnd() { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

function DateModeBar({ mode, onChange }: { mode: DateMode; onChange: (m: DateMode) => void }) {
  const modes: { value: DateMode; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom' },
  ];
  return (
    <div className="flex rounded border border-gray-300 overflow-hidden">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === m.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          } ${m.value !== 'all' ? 'border-l border-gray-300' : ''}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('Income Statement');
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Entities</option>
          {entities?.map((ent: Entity) => (
            <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
          ))}
        </select>
      </div>

      {activeTab === 'Income Statement' && <IncomeStatementTab entity={entityFilter} />}
      {activeTab === 'Balance Sheet' && <BalanceSheetTab entity={entityFilter} />}
      {activeTab === 'Monthly Summary' && <MonthlySummaryTab entity={entityFilter} />}
      {activeTab === 'Cash Flow' && <CashFlowTab entity={entityFilter} />}
      {activeTab === 'Accounts Receivable' && <AccountsReceivableTab entity={entityFilter} />}
      {activeTab === 'Accounts Payable' && <AccountsPayableTab entity={entityFilter} />}
    </div>
  );
}

function CategoryDrillDown({ type, category, startDate, endDate, entity }: {
  type: string; category: string; startDate: string; endDate: string; entity?: string;
}) {
  const { data: txns, isLoading } = useIncomeStatementTransactions(type, category, startDate, endDate, true, entity || undefined);

  if (isLoading) return <tr><td colSpan={3} className="py-2 pl-8 text-xs text-gray-400">Loading transactions...</td></tr>;
  if (!txns || txns.length === 0) return <tr><td colSpan={3} className="py-2 pl-8 text-xs text-gray-400">No transactions found.</td></tr>;

  return (
    <>
      {txns.map((txn: Transaction) => {
        const inv = txn.invoice as any;
        const pr = txn.paymentRequest as any;
        return (
          <tr key={txn._id} className="bg-gray-50/70">
            <td className="py-1.5 pl-8 text-xs text-gray-500">
              {new Date(txn.date).toLocaleDateString()}
            </td>
            <td className="py-1.5 text-xs text-gray-600">
              <Link to={`/transactions`} className="hover:text-blue-600 hover:underline">
                {txn.description}
              </Link>
              {inv?.invoiceNumber && (
                <Link to={`/invoices/${inv._id}`} className="ml-2 text-blue-500 hover:underline">
                  {inv.invoiceNumber}
                </Link>
              )}
              {pr?.requestNumber && (
                <Link to={`/payment-requests/${pr._id}`} className="ml-2 text-blue-500 hover:underline">
                  {pr.requestNumber}
                </Link>
              )}
            </td>
            <td className="py-1.5 text-right font-mono text-xs">{formatMoney(txn.amount)}</td>
          </tr>
        );
      })}
    </>
  );
}

function IncomeStatementTab({ entity }: { entity: string }) {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());
  const { data, isLoading } = useIncomeStatement(startDate, endDate, entity || undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleExpand(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  function renderCategoryRows(items: IncomeStatementLine[], type: 'income' | 'expense') {
    return items.map((item) => {
      const key = `${type}:${item.category}`;
      const isOpen = expanded === key;
      return (
        <>
          <tr
            key={key}
            className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleExpand(key)}
          >
            <td className="py-2 capitalize flex items-center gap-1">
              {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              {item.category.replace(/_/g, ' ')}
            </td>
            <td className="py-2 text-right text-gray-500">{item.count} txn</td>
            <td className="py-2 text-right font-mono w-40">{formatMoney(item.total)}</td>
          </tr>
          {isOpen && (
            <CategoryDrillDown type={type} category={item.category} startDate={startDate} endDate={endDate} entity={entity || undefined} />
          )}
        </>
      );
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setExpanded(null); }}
            className="border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setExpanded(null); }}
            className="border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-green-700 mb-3">Revenue</h2>
            {data.income.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {renderCategoryRows(data.income, 'income')}
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

          <div>
            <h2 className="text-lg font-semibold text-red-700 mb-3">Expenses</h2>
            {data.expenses.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {renderCategoryRows(data.expenses, 'expense')}
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

function CashFlowTab({ entity }: { entity: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading } = useCashFlow(year, entity || undefined);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">Year</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Month</th>
                <th className="text-right px-4 py-3 font-medium text-green-600">Income</th>
                <th className="text-right px-4 py-3 font-medium text-red-600">Expense</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m: CashFlowMonth) => (
                <tr key={m.month} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{monthNames[m.month]}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(m.income)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(m.expense)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr className="font-bold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(data.totals.income)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(data.totals.expense)}</td>
                <td className={`px-4 py-3 text-right font-mono ${data.totals.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMoney(data.totals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AccountsReceivableTab({ entity }: { entity: string }) {
  const [mode, setMode] = useState<DateMode>('month');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());

  const effectiveStart = mode === 'all' ? undefined : mode === 'month' ? monthStart() : startDate;
  const effectiveEnd = mode === 'all' ? undefined : mode === 'month' ? monthEnd() : endDate;
  const { data, isLoading } = useAccountsReceivable(effectiveStart, effectiveEnd, entity || undefined);

  return (
    <div className="max-w-4xl">
      <div className="flex gap-4 mb-6 items-end">
        <DateModeBar mode={mode} onChange={(m) => setMode(m)} />
        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Outstanding</div>
              <div className="text-xl font-bold font-mono text-amber-600">{formatMoney(data.summary.totalDue)}</div>
              <div className="text-xs text-gray-400">{data.summary.count} invoices</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Overdue</div>
              <div className="text-xl font-bold font-mono text-red-600">{formatMoney(data.summary.overdueDue)}</div>
              <div className="text-xs text-gray-400">{data.summary.overdueCount} invoices</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Current</div>
              <div className="text-xl font-bold font-mono text-green-600">
                {formatMoney(data.summary.totalDue - data.summary.overdueDue)}
              </div>
              <div className="text-xs text-gray-400">{data.summary.count - data.summary.overdueCount} invoices</div>
            </div>
          </div>

          {data.invoices.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Due</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv: ARInvoice) => {
                    const clientName = typeof inv.client === 'object' ? inv.client.name : '';
                    const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date();
                    return (
                      <tr key={inv._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link to={`/invoices/${inv._id}`} className="text-blue-600 hover:underline font-medium">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{clientName}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatMoney(inv.total)}</td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(inv.amountPaid)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600 font-medium">{formatMoney(inv.amountDue)}</td>
                        <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No outstanding invoices{mode !== 'all' ? ' in this period' : ''}.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

function AccountsPayableTab({ entity }: { entity: string }) {
  const [mode, setMode] = useState<DateMode>('all');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());

  const effectiveStart = mode === 'all' ? undefined : mode === 'month' ? monthStart() : startDate;
  const effectiveEnd = mode === 'all' ? undefined : mode === 'month' ? monthEnd() : endDate;
  const { data, isLoading } = useAccountsPayable(effectiveStart, effectiveEnd, entity || undefined);

  return (
    <div className="max-w-5xl">
      <div className="flex gap-4 mb-6 items-end">
        <DateModeBar mode={mode} onChange={(m) => setMode(m)} />
        {mode === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Pending Approval</div>
              <div className="text-xl font-bold font-mono text-amber-600">{formatMoney(data.summary.pendingAmount)}</div>
              <div className="text-xs text-gray-400">{data.summary.pendingCount} requests</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Approved (Awaiting Execution)</div>
              <div className="text-xl font-bold font-mono text-blue-600">{formatMoney(data.summary.approvedAmount)}</div>
              <div className="text-xs text-gray-400">{data.summary.approvedCount} requests</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Committed</div>
              <div className="text-xl font-bold font-mono text-red-600">{formatMoney(data.summary.totalAmount)}</div>
              <div className="text-xs text-gray-400">{data.summary.count} requests</div>
            </div>
          </div>

          {data.categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Budget Breakdown by Category</h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.categoryBreakdown.map((cat: APCategoryBreakdown) => (
                    <tr key={cat.category} className="border-b border-gray-100">
                      <td className="py-2 capitalize">{cat.category.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-right font-mono w-40">{formatMoney(cat.total)}</td>
                      <td className="py-2 text-right text-gray-400 w-20">
                        {data.summary.totalAmount > 0
                          ? `${Math.round((cat.total / data.summary.totalAmount) * 100)}%`
                          : ''}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right font-mono text-red-600">{formatMoney(data.summary.totalAmount)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {data.requests.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Request #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Payee(s)</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.requests.map((req: APPaymentRequest) => {
                    const payeeNames = req.items
                      .map((it) => (typeof it.payee === 'object' ? it.payee.name : ''))
                      .filter(Boolean);
                    const uniquePayees = [...new Set(payeeNames)].join(', ') || 'N/A';
                    const categories = [...new Set(req.items.map((it) => it.category))].join(', ');
                    const createdBy = typeof req.createdBy === 'object' ? req.createdBy.name : '';

                    return (
                      <tr key={req._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link to={`/payment-requests/${req._id}`} className="text-blue-600 hover:underline font-medium">
                            {req.requestNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                          {req.description || req.items[0]?.description || ''}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{uniquePayees}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize text-xs">{categories}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium">{formatMoney(req.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            req.status === 'approved'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(req.createdAt).toLocaleDateString()}
                          {createdBy && <span className="block text-gray-400">{createdBy}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-4 py-3" colSpan={4}>Total</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(data.summary.totalAmount)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No pending or approved payment requests{mode !== 'all' ? ' in this period' : ''}.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

function BalanceSheetTab({ entity }: { entity: string }) {
  const { data, isLoading } = useBalanceSheet(entity || undefined);

  return (
    <div className="max-w-3xl">
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-blue-700 mb-4">Assets</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-700" colSpan={2}>Cash & Bank</td>
                  <td className="py-2 text-right font-mono w-40">{formatMoney(data.assets.cash.total)}</td>
                </tr>
                {data.assets.cash.breakdown.map((f: { name: string; type: string; balance: number }) => (
                  <tr key={f.name} className="border-b border-gray-50">
                    <td className="py-1.5 pl-6 text-gray-500 text-xs" colSpan={2}>
                      {f.name}
                      <span className="ml-2 text-gray-400 capitalize">({f.type.replace(/_/g, ' ')})</span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs text-gray-500">{formatMoney(f.balance)}</td>
                  </tr>
                ))}
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-700" colSpan={2}>
                    Accounts Receivable
                    <span className="ml-2 text-xs text-gray-400 font-normal">{data.assets.accountsReceivable.count} invoices</span>
                  </td>
                  <td className="py-2 text-right font-mono w-40">{formatMoney(data.assets.accountsReceivable.total)}</td>
                </tr>
                <tr className="font-bold border-t-2 border-gray-300">
                  <td className="py-3" colSpan={2}>Total Assets</td>
                  <td className="py-3 text-right font-mono text-blue-700">{formatMoney(data.assets.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-red-700 mb-4">Liabilities</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-gray-700" colSpan={2}>
                    Accounts Payable
                    <span className="ml-2 text-xs text-gray-400 font-normal">{data.liabilities.accountsPayable.count} requests</span>
                  </td>
                  <td className="py-2 text-right font-mono w-40">{formatMoney(data.liabilities.accountsPayable.total)}</td>
                </tr>
                <tr className="font-bold border-t-2 border-gray-300">
                  <td className="py-3" colSpan={2}>Total Liabilities</td>
                  <td className="py-3 text-right font-mono text-red-700">{formatMoney(data.liabilities.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Net Position</span>
              <span className={`font-mono ${data.netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatMoney(data.netPosition)}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Total Assets − Total Liabilities</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthlySummaryTab({ entity }: { entity: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, isLoading } = useMonthlySummary(year, month, entity || undefined);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  function DeltaCell({ value }: { value: number }) {
    if (value === 0) return <td className="py-2.5 text-right font-mono text-gray-400">—</td>;
    return (
      <td className={`py-2.5 text-right font-mono font-medium ${value > 0 ? 'text-green-600' : 'text-red-600'}`}>
        {value > 0 ? '+' : ''}{formatMoney(value)}
      </td>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            {monthNames.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : data ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 w-1/3"></th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Opening</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Closing</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-2.5 font-medium text-gray-700">Cash & Bank</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.opening.cash)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.closing.cash)}</td>
                  <DeltaCell value={data.change.cash} />
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-2.5 font-medium text-gray-700">Accounts Receivable</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.opening.accountsReceivable)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.closing.accountsReceivable)}</td>
                  <DeltaCell value={data.change.accountsReceivable} />
                </tr>
                <tr className="border-b border-gray-200 font-bold bg-blue-50/50">
                  <td className="px-5 py-2.5 text-blue-700">Total Assets</td>
                  <td className="px-5 py-2.5 text-right font-mono text-blue-700">{formatMoney(data.opening.totalAssets)}</td>
                  <td className="px-5 py-2.5 text-right font-mono text-blue-700">{formatMoney(data.closing.totalAssets)}</td>
                  <DeltaCell value={data.change.totalAssets} />
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-2.5 font-medium text-gray-700">Accounts Payable</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.opening.accountsPayable)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatMoney(data.closing.accountsPayable)}</td>
                  <DeltaCell value={data.change.accountsPayable} />
                </tr>
                <tr className="font-bold bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-5 py-3">Net Position</td>
                  <td className={`px-5 py-3 text-right font-mono ${data.opening.netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(data.opening.netPosition)}
                  </td>
                  <td className={`px-5 py-3 text-right font-mono ${data.closing.netPosition >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(data.closing.netPosition)}
                  </td>
                  <DeltaCell value={data.change.netPosition} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Operations for {monthNames[month]} {year}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-xs text-green-600 font-medium mb-1">Revenue</div>
                <div className="text-xl font-bold font-mono text-green-700">{formatMoney(data.operations.income)}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <div className="text-xs text-red-600 font-medium mb-1">Expenses</div>
                <div className="text-xl font-bold font-mono text-red-700">{formatMoney(data.operations.expense)}</div>
              </div>
              <div className={`${data.operations.net >= 0 ? 'bg-blue-50' : 'bg-amber-50'} rounded-lg p-4 text-center`}>
                <div className={`text-xs font-medium mb-1 ${data.operations.net >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                  Net Income
                </div>
                <div className={`text-xl font-bold font-mono ${data.operations.net >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  {formatMoney(data.operations.net)}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
