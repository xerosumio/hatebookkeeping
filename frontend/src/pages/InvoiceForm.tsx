import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClients, useCreateInvoice, useUpdateInvoice, useInvoice, useEntities, useSettings } from '../api/hooks';
import LineItemEditor from '../components/LineItemEditor';
import { formatMoney, decimalToCents, centsToDecimal } from '../utils/money';
import type { LineItem, Client } from '../types';

const TERM_OPTIONS = [
  { value: '', label: 'Select terms...' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'custom', label: 'Custom...' },
];

function termsLabel(terms: string): string {
  const opt = TERM_OPTIONS.find((o) => o.value === terms);
  if (opt) return opt.label;
  const m = terms.match(/^custom_(\d+)$/);
  if (m) return `Net ${m[1]}`;
  return terms;
}

function computeDueDatePreview(terms: string): string {
  if (!terms) return '';
  const base = new Date();
  if (terms === 'due_on_receipt') return base.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const m = terms.match(/^(?:net_|custom_)(\d+)$/);
  if (m) {
    const d = new Date(base);
    d.setDate(d.getDate() + parseInt(m[1], 10));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return '';
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const { data: clients } = useClients();
  const { data: existing, isLoading: loadingInvoice } = useInvoice(id || '');
  const { data: entities } = useEntities();
  const { data: settings } = useSettings();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const [entity, setEntity] = useState('');
  const [client, setClient] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [customDays, setCustomDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [bankAccountInfo, setBankAccountInfo] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setEntity(typeof existing.entity === 'object' ? (existing.entity as any)._id : existing.entity);
      const clientId = typeof existing.client === 'object' ? (existing.client as Client)._id : existing.client;
      setClient(clientId);
      setLineItems(existing.lineItems);
      setDiscount(centsToDecimal(existing.discount));
      setBankAccountInfo(existing.bankAccountInfo || '');
      setNotes(existing.notes || '');
      if (existing.paymentTerms) {
        const m = existing.paymentTerms.match(/^custom_(\d+)$/);
        if (m) {
          setPaymentTerms('custom');
          setCustomDays(parseInt(m[1], 10));
        } else {
          setPaymentTerms(existing.paymentTerms);
        }
      }
      setLoaded(true);
    }
  }, [isEdit, existing, loaded]);

  useEffect(() => {
    if (!isEdit && !entity && settings?.defaultEntityId) {
      setEntity(settings.defaultEntityId);
    }
  }, [isEdit, entity, settings]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountCents = decimalToCents(discount);
  const total = subtotal - discountCents;

  const effectiveTerms = paymentTerms === 'custom' && customDays > 0 ? `custom_${customDays}` : paymentTerms === 'custom' ? '' : paymentTerms;
  const dueDatePreview = useMemo(() => computeDueDatePreview(effectiveTerms), [effectiveTerms]);

  const isPending = createInvoice.isPending || updateInvoice.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      entity,
      client,
      lineItems,
      subtotal,
      discount: discountCents,
      total,
      paymentTerms: effectiveTerms,
      notes,
      bankAccountInfo,
    };
    try {
      if (isEdit) {
        await updateInvoice.mutateAsync({ id: id!, data: payload });
      } else {
        await createInvoice.mutateAsync(payload);
      }
      navigate('/invoices');
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} invoice`);
    }
  }

  if (isEdit && loadingInvoice) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Entity *</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select entity...</option>
            {entities?.filter((e) => e.active).map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} ({e.code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client...</option>
              {clients?.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
            <div className="flex gap-2 items-start">
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TERM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {paymentTerms === 'custom' && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">Net</span>
                  <input
                    type="number"
                    value={customDays || ''}
                    onChange={(e) => setCustomDays(Math.max(0, parseInt(e.target.value) || 0))}
                    min={1}
                    className="w-16 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="days"
                  />
                </div>
              )}
            </div>
            {dueDatePreview && (
              <p className="text-xs text-gray-400 mt-1">Due date: {dueDatePreview}</p>
            )}
          </div>
        </div>

        <LineItemEditor items={lineItems} onChange={setLineItems} />

        <div className="flex justify-end gap-6 text-sm border-t border-gray-200 pt-4">
          <div className="text-right space-y-1">
            <div className="text-gray-500">Subtotal: <span className="font-mono">{formatMoney(subtotal)}</span></div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-gray-500">Discount:</span>
              <input
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                min={0}
                step={0.01}
                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-lg font-bold">Total: <span className="font-mono">{formatMoney(total)}</span></div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Info</label>
          <textarea
            value={bankAccountInfo}
            onChange={(e) => setBankAccountInfo(e.target.value)}
            rows={3}
            placeholder="Leave blank to use company default from Settings"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Bank name, account number, SWIFT, etc. Leave blank to use company default.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Invoice')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
