import { Link } from 'react-router-dom';
import { useReceipts } from '../api/hooks';
import { formatMoney } from '../utils/money';
import type { Client, Invoice } from '../types';

export default function ReceiptList() {
  const { data: receipts, isLoading } = useReceipts();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Receipts</h1>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !receipts?.length ? (
        <p className="text-gray-500">No receipts yet. Record payments from invoice detail pages.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Method</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/receipts/${r._id}`} className="text-blue-600 hover:underline">
                      {r.receiptNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {typeof r.client === 'object' ? (r.client as Client).name : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {typeof r.invoice === 'object' ? (r.invoice as Invoice).invoiceNumber : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{r.paymentMethod}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(r.paymentDate).toLocaleDateString()}
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
