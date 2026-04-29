import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTransactions, useDeleteTransaction, useEntities, useIntercompanyTransfer } from '../api/hooks';
import { formatMoney, titleCase, decimalToCents } from '../utils/money';
import { Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react';
import TransactionForm from './TransactionForm';
import { PendingBanner } from '../components/PendingBankTransactions';
import type { Transaction, Entity } from '../types';

export default function TransactionList() {
  const [typeFilter, setTypeFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const { data: entities } = useEntities();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showIntercompany, setShowIntercompany] = useState(false);
  const [icForm, setIcForm] = useState({
    fromEntity: '', toEntity: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '',
    fromBankAccount: '', toBankAccount: '',
  });
  const [icError, setIcError] = useState('');
  const intercompanyTransfer = useIntercompanyTransfer();
  const filters: Record<string, string> = {};
  if (typeFilter) filters.type = typeFilter;
  if (entityFilter) filters.entity = entityFilter;

  const { data: transactions, isLoading } = useTransactions(Object.keys(filters).length ? filters : undefined);
  const deleteTransaction = useDeleteTransaction();

  function handleEdit(t: Transaction) {
    setEditing(t);
    setShowForm(true);
  }

  function handleDone() {
    setShowForm(false);
    setEditing(null);
  }

  function handleDelete(t: Transaction) {
    if (confirm(`Delete this ${t.type} transaction?\n${t.description}`)) {
      deleteTransaction.mutate(t._id);
    }
  }

  async function handleIntercompanyTransfer() {
    setIcError('');
    try {
      await intercompanyTransfer.mutateAsync({
        fromEntity: icForm.fromEntity,
        toEntity: icForm.toEntity,
        amount: decimalToCents(Number(icForm.amount)),
        date: icForm.date,
        description: icForm.description,
        fromBankAccount: icForm.fromBankAccount || undefined,
        toBankAccount: icForm.toBankAccount || undefined,
      });
      setShowIntercompany(false);
      setIcForm({ fromEntity: '', toEntity: '', amount: '', date: new Date().toISOString().slice(0, 10), description: '', fromBankAccount: '', toBankAccount: '' });
    } catch (err: any) {
      setIcError(err.response?.data?.error || 'Failed to create intercompany transfer');
    }
  }

  function getPayeePayer(t: Transaction): { name: string; link?: string } {
    if (t.payee && typeof t.payee === 'object') {
      return { name: t.payee.name, link: `/payees` };
    }
    if (t.client && typeof t.client === 'object') {
      return { name: t.client.name, link: `/clients` };
    }
    if (t.invoice && typeof t.invoice === 'object' && t.invoice.client && typeof t.invoice.client === 'object') {
      return { name: t.invoice.client.name, link: `/clients` };
    }
    if (t.paymentRequest && typeof t.paymentRequest === 'object' && t.paymentRequest.items?.length) {
      const firstPayee = t.paymentRequest.items[0]?.payee;
      if (firstPayee && typeof firstPayee === 'object') return { name: firstPayee.name, link: `/payees` };
    }
    return { name: '' };
  }

  function getLinkedDocs(t: Transaction) {
    const docs: { label: string; link: string; color: string }[] = [];
    if (t.invoice && typeof t.invoice === 'object') {
      docs.push({ label: t.invoice.invoiceNumber, link: `/invoices/${t.invoice._id}`, color: 'bg-blue-50 text-blue-700' });
    }
    if (t.receipt && typeof t.receipt === 'object') {
      const r = t.receipt as { _id: string; receiptNumber: string };
      docs.push({ label: r.receiptNumber, link: `/receipts/${r._id}`, color: 'bg-green-50 text-green-700' });
    }
    if (t.paymentRequest && typeof t.paymentRequest === 'object') {
      docs.push({ label: t.paymentRequest.requestNumber, link: `/payment-requests/${t.paymentRequest._id}`, color: 'bg-purple-50 text-purple-700' });
    }
    return docs;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        {!showForm && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowIntercompany(true)}
              className="flex items-center gap-1 border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              <ArrowLeftRight size={16} /> Intercompany Transfer
            </button>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Add Transaction
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <TransactionForm onDone={handleDone} existing={editing} />
        </div>
      )}

      <PendingBanner />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-2">
          {['', 'income', 'expense'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded text-sm ${
                typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t ? titleCase(t) : 'All'}
            </button>
          ))}
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Entities</option>
          {entities?.map((ent) => (
            <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !transactions?.length ? (
        <p className="text-gray-500">No transactions found.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payee / Payer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Links</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.date).toLocaleDateString()}
                    {t.accountingDate && t.accountingDate.slice(0, 10) !== t.date.slice(0, 10) && (
                      <div className="text-[10px] text-amber-600" title="Accounting date differs from payment date">
                        Acct: {new Date(t.accountingDate).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {titleCase(t.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {t.entity && typeof t.entity === 'object' ? (t.entity as Entity).code : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {(() => {
                      const pp = getPayeePayer(t);
                      if (!pp.name) return '—';
                      return pp.link ? (
                        <Link to={pp.link} className="text-blue-600 hover:underline">{pp.name}</Link>
                      ) : pp.name;
                    })()}
                  </td>
                  <td className="px-4 py-3">{t.description}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.bankAccount || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.bankReference}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {getLinkedDocs(t).map((d) => (
                        <Link
                          key={d.link}
                          to={d.link}
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${d.color} hover:opacity-80`}
                        >
                          {d.label}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showIntercompany && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[28rem]">
            <h3 className="text-lg font-bold mb-4">Intercompany Transfer</h3>
            {icError && <div className="bg-red-50 text-red-600 text-sm p-2 rounded mb-3">{icError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Entity</label>
                <select value={icForm.fromEntity} onChange={(e) => setIcForm({ ...icForm, fromEntity: e.target.value, fromBankAccount: '' })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {entities?.map((ent) => <option key={ent._id} value={ent._id}>{ent.code} -- {ent.name}</option>)}
                </select>
              </div>
              {icForm.fromEntity && (() => {
                const ent = entities?.find((e) => e._id === icForm.fromEntity);
                return ent?.bankAccounts?.length ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Bank Account</label>
                    <select value={icForm.fromBankAccount} onChange={(e) => setIcForm({ ...icForm, fromBankAccount: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                      <option value="">Select...</option>
                      {ent.bankAccounts.map((acc, i) => <option key={i} value={acc.name}>{acc.name}{acc.bankName ? ` (${acc.bankName})` : ''}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Entity</label>
                <select value={icForm.toEntity} onChange={(e) => setIcForm({ ...icForm, toEntity: e.target.value, toBankAccount: '' })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {entities?.filter((e) => e._id !== icForm.fromEntity).map((ent) => <option key={ent._id} value={ent._id}>{ent.code} -- {ent.name}</option>)}
                </select>
              </div>
              {icForm.toEntity && (() => {
                const ent = entities?.find((e) => e._id === icForm.toEntity);
                return ent?.bankAccounts?.length ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Bank Account</label>
                    <select value={icForm.toBankAccount} onChange={(e) => setIcForm({ ...icForm, toBankAccount: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                      <option value="">Select...</option>
                      {ent.bankAccounts.map((acc, i) => <option key={i} value={acc.name}>{acc.name}{acc.bankName ? ` (${acc.bankName})` : ''}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (HKD)</label>
                <input type="number" step="0.01" value={icForm.amount} onChange={(e) => setIcForm({ ...icForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={icForm.date} onChange={(e) => setIcForm({ ...icForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={icForm.description} onChange={(e) => setIcForm({ ...icForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Window Server licenses" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleIntercompanyTransfer}
                disabled={!icForm.fromEntity || !icForm.toEntity || !icForm.amount || !icForm.description || intercompanyTransfer.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {intercompanyTransfer.isPending ? 'Creating...' : 'Create Transfer'}
              </button>
              <button onClick={() => { setShowIntercompany(false); setIcError(''); }}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
