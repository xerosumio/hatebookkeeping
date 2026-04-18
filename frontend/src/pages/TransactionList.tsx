import { useState } from 'react';
import { useTransactions, useDeleteTransaction } from '../api/hooks';
import { formatMoney } from '../utils/money';
import { Plus, Trash2 } from 'lucide-react';
import TransactionForm from './TransactionForm';

export default function TransactionList() {
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const filters: Record<string, string> = {};
  if (typeFilter) filters.type = typeFilter;

  const { data: transactions, isLoading } = useTransactions(Object.keys(filters).length ? filters : undefined);
  const deleteTransaction = useDeleteTransaction();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <TransactionForm onDone={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['', 'income', 'expense'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded text-sm ${
              typeFilter === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t || 'All'}
          </button>
        ))}
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ref</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{t.description}</td>
                  <td className={`px-4 py-3 text-right font-mono ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.bankReference}</td>
                  <td className="px-4 py-3">
                    {!t.invoice && !t.receipt && !t.paymentRequest && (
                      <button
                        onClick={() => { if (confirm('Delete?')) deleteTransaction.mutate(t._id); }}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
