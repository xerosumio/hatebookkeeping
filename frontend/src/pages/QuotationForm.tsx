import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useClients, useQuotation, useCreateQuotation, useUpdateQuotation, uploadFile } from '../api/hooks';
import LineItemEditor from '../components/LineItemEditor';
import PaymentScheduleEditor from '../components/PaymentScheduleEditor';
import { formatMoney, decimalToCents } from '../utils/money';
import type { LineItem, PaymentMilestone } from '../types';

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const sigCanvas = useRef<SignatureCanvas>(null);

  const { data: clients } = useClients();
  const { data: existing } = useQuotation(id || '');
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();

  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentMilestone[]>([]);
  const [companyChopUrl, setCompanyChopUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (existing) {
      setClient(typeof existing.client === 'object' ? existing.client._id : existing.client);
      setTitle(existing.title);
      setLineItems(existing.lineItems);
      setDiscount(existing.discount);
      setTermsAndConditions(existing.termsAndConditions);
      setPaymentSchedule(existing.paymentSchedule);
      setCompanyChopUrl(existing.companyChopUrl);
      setSignatureUrl(existing.signatureUrl);
      setValidUntil(existing.validUntil ? existing.validUntil.slice(0, 10) : '');
      setNotes(existing.notes);
    }
  }, [existing]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountCents = decimalToCents(discount);
  const total = subtotal - discountCents;

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile(file);
      setter(path);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function saveSignature() {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    const dataUrl = sigCanvas.current.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'signature.png', { type: 'image/png' });
    setUploading(true);
    try {
      const path = await uploadFile(file);
      setSignatureUrl(path);
    } catch {
      setError('Signature upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const data = {
      client,
      title,
      lineItems,
      subtotal,
      discount: discountCents,
      total,
      termsAndConditions,
      paymentSchedule,
      companyChopUrl,
      signatureUrl,
      validUntil: validUntil || undefined,
      notes,
    };

    try {
      if (isEdit) {
        await updateQuotation.mutateAsync({ id: id!, data });
      } else {
        await createQuotation.mutateAsync(data);
      }
      navigate('/quotations');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save quotation');
    }
  }

  const loading = createQuotation.isPending || updateQuotation.isPending || uploading;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

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
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Website Development"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

        <PaymentScheduleEditor schedule={paymentSchedule} total={total} onChange={setPaymentSchedule} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
          <textarea
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            rows={6}
            placeholder="Enter terms and conditions..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Chop</label>
            {companyChopUrl && (
              <img src={companyChopUrl} alt="Company chop" className="w-32 h-32 object-contain border rounded mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e, setCompanyChopUrl)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
            {signatureUrl ? (
              <div>
                <img src={signatureUrl} alt="Signature" className="w-64 h-24 object-contain border rounded mb-2" />
                <button
                  type="button"
                  onClick={() => setSignatureUrl('')}
                  className="text-sm text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <div className="border border-gray-300 rounded mb-2">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ width: 400, height: 100, className: 'w-full' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveSignature}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Save Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => sigCanvas.current?.clear()}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Clear Pad
                  </button>
                </div>
                <div className="mt-2">
                  <span className="text-sm text-gray-500 mr-2">Or upload:</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, setSignatureUrl)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Quotation' : 'Create Quotation'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
