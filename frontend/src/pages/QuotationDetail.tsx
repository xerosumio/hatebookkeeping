import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuotation, useUpdateQuotationStatus } from '../api/hooks';
import { formatMoney } from '../utils/money';
import type { Client } from '../types';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: q, isLoading } = useQuotation(id || '');
  const updateStatus = useUpdateQuotationStatus();

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (!q) return <p className="text-gray-500">Quotation not found.</p>;

  const client = typeof q.client === 'object' ? (q.client as Client) : null;

  async function changeStatus(status: string) {
    await updateStatus.mutateAsync({ id: id!, status });
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{q.quotationNumber}</h1>
          <p className="text-gray-500">{q.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusColors[q.status]}`}>
            {q.status}
          </span>
          {q.status === 'draft' && (
            <>
              <Link
                to={`/quotations/${id}/edit`}
                className="border border-gray-300 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                Edit
              </Link>
              <button
                onClick={() => changeStatus('sent')}
                disabled={updateStatus.isPending}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Mark as Sent
              </button>
            </>
          )}
          {q.status === 'sent' && (
            <>
              <button
                onClick={() => changeStatus('accepted')}
                disabled={updateStatus.isPending}
                className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => changeStatus('rejected')}
                disabled={updateStatus.isPending}
                className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {q.status === 'accepted' && (
            <button
              onClick={() => navigate(`/quotations/${id}/convert`)}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"
            >
              Convert to Invoice
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {client && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Client</h3>
            <p className="font-medium">{client.name}</p>
            {client.contactPerson && <p className="text-sm text-gray-600">{client.contactPerson}</p>}
            {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Line Items</h3>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-2 font-medium text-gray-600">Description</th>
                <th className="text-right py-2 font-medium text-gray-600 w-20">Qty</th>
                <th className="text-right py-2 font-medium text-gray-600 w-28">Unit Price</th>
                <th className="text-right py-2 font-medium text-gray-600 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-mono">{formatMoney(item.unitPrice)}</td>
                  <td className="py-2 text-right font-mono">{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-gray-200 pt-2 mt-2 text-sm text-right space-y-1">
            <div className="text-gray-500">Subtotal: {formatMoney(q.subtotal)}</div>
            {q.discount > 0 && <div className="text-gray-500">Discount: -{formatMoney(q.discount)}</div>}
            <div className="text-lg font-bold">Total: {formatMoney(q.total)}</div>
          </div>
        </div>

        {q.paymentSchedule.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Payment Schedule</h3>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 font-medium text-gray-600">Milestone</th>
                  <th className="text-right py-2 font-medium text-gray-600 w-20">%</th>
                  <th className="text-right py-2 font-medium text-gray-600 w-28">Amount</th>
                  <th className="text-left py-2 font-medium text-gray-600">Due</th>
                </tr>
              </thead>
              <tbody>
                {q.paymentSchedule.map((m, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2">{m.milestone}</td>
                    <td className="py-2 text-right">{m.percentage}%</td>
                    <td className="py-2 text-right font-mono">{formatMoney(m.amount)}</td>
                    <td className="py-2 text-gray-600">{m.dueDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {q.termsAndConditions && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Terms & Conditions</h3>
            <p className="text-sm whitespace-pre-wrap">{q.termsAndConditions}</p>
          </div>
        )}

        {q.validUntil && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Valid Until</h3>
            <p className="text-sm">{new Date(q.validUntil).toLocaleDateString()}</p>
          </div>
        )}

        {q.notes && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
            <p className="text-sm">{q.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {q.companyChopUrl && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Company Chop</h3>
              <img src={q.companyChopUrl} alt="Company chop" className="w-32 h-32 object-contain border rounded" />
            </div>
          )}
          {q.signatureUrl && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Signature</h3>
              <img src={q.signatureUrl} alt="Signature" className="w-64 h-24 object-contain border rounded" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
