import { useState, useEffect, useMemo, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useClients, useCreateInvoice, useUpdateInvoice, useInvoice, useEntities, useSettings, useUsers, uploadFile } from '../api/hooks';
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


function computeDueDatePreview(terms: string, invoiceDate: string): string {
  if (!terms) return '';
  const base = invoiceDate ? new Date(invoiceDate + 'T00:00:00') : new Date();
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
  const { data: users } = useUsers();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [entity, setEntity] = useState('');
  const [client, setClient] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [customDays, setCustomDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [bankAccountInfo, setBankAccountInfo] = useState('');
  const [sigSource, setSigSource] = useState<'default' | 'user' | 'custom'>('default');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [selectedSigUser, setSelectedSigUser] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setEntity(existing.entity && typeof existing.entity === 'object' ? (existing.entity as any)._id : (existing.entity || ''));
      const clientId = existing.client && typeof existing.client === 'object' ? (existing.client as Client)._id : (existing.client || '');
      setClient(clientId);
      if (existing.invoiceDate) {
        setInvoiceDate(new Date(existing.invoiceDate).toISOString().slice(0, 10));
      } else if (existing.createdAt) {
        setInvoiceDate(new Date(existing.createdAt).toISOString().slice(0, 10));
      }
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
      if (existing.signatureUrl) {
        setSignatureUrl(existing.signatureUrl);
        setSigSource('custom');
      }
      setLoaded(true);
    }
  }, [isEdit, existing, loaded]);

  // Re-evaluate signature source once users load -- detect if the saved
  // signatureUrl belongs to a team member so we select the right radio.
  const [sigResolved, setSigResolved] = useState(false);
  useEffect(() => {
    if (!sigResolved && existing?.signatureUrl && users?.length) {
      const matchingUser = users.find((u) => u.signatureUrl === existing.signatureUrl);
      if (matchingUser) {
        setSigSource('user');
        setSelectedSigUser(matchingUser._id);
      }
      setSigResolved(true);
    }
  }, [existing, users, sigResolved]);

  function getDefaultBankAccountInfo(entityId: string): string {
    const ent = entities?.find((e) => e._id === entityId);
    if (!ent?.bankAccounts?.length) return '';
    const idx = ent.defaultBankAccountIndex || 0;
    const ba = ent.bankAccounts[idx] || ent.bankAccounts[0];
    if (!ba) return '';
    return formatBankInfo(ba, ent.name);
  }

  function formatBankInfo(ba: { name?: string; accountNumber?: string; bankCode?: string; branchCode?: string; swiftCode?: string; bankName?: string; location?: string }, entityName?: string): string {
    const lines: string[] = ['Airwallex Global Account information:'];
    lines.push(`Global Account name: ${entityName || ba.name || ''}`);
    if (ba.accountNumber) lines.push(`Bank account number: ${ba.accountNumber}`);
    if (ba.bankCode) lines.push(`Bank code: ${ba.bankCode}`);
    if (ba.branchCode) lines.push(`Branch code: ${ba.branchCode}`);
    if (ba.swiftCode) lines.push(`SWIFT code: ${ba.swiftCode}`);
    if (ba.bankName) lines.push(`Bank name: ${ba.bankName}`);
    if (ba.location) lines.push(`Location: ${ba.location}`);
    return lines.join('\n');
  }

  useEffect(() => {
    if (!isEdit && !entity && settings?.defaultEntityId) {
      setEntity(settings.defaultEntityId);
      if (!bankAccountInfo) {
        setBankAccountInfo(getDefaultBankAccountInfo(settings.defaultEntityId));
      }
    }
  }, [isEdit, entity, settings, entities]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountCents = decimalToCents(discount);
  const total = subtotal - discountCents;

  const effectiveTerms = paymentTerms === 'custom' && customDays > 0 ? `custom_${customDays}` : paymentTerms === 'custom' ? '' : paymentTerms;
  const dueDatePreview = useMemo(() => computeDueDatePreview(effectiveTerms, invoiceDate), [effectiveTerms, invoiceDate]);

  const usersWithSig = useMemo(() => users?.filter((u) => u.active && u.signatureUrl) || [], [users]);

  function getEffectiveSignatureUrl() {
    if (sigSource === 'default') return '';
    if (sigSource === 'user') {
      const u = users?.find((u) => u._id === selectedSigUser);
      return u?.signatureUrl || '';
    }
    return signatureUrl;
  }

  async function handleSigUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const isPending = createInvoice.isPending || updateInvoice.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      entity,
      client,
      invoiceDate,
      lineItems,
      subtotal,
      discount: discountCents,
      total,
      paymentTerms: effectiveTerms,
      notes,
      bankAccountInfo,
      signatureUrl: getEffectiveSignatureUrl(),
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
            onChange={(e) => { setEntity(e.target.value); setBankAccountInfo(getDefaultBankAccountInfo(e.target.value)); }}
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

        <div className="grid grid-cols-3 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
          {(() => {
            const selEntity = entities?.find((e) => e._id === entity);
            const bankAccounts = selEntity?.bankAccounts || [];
            return bankAccounts.length > 0 ? (
              <>
                <select
                  value={bankAccountInfo}
                  onChange={(e) => setBankAccountInfo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Use entity default</option>
                  {bankAccounts.map((ba, idx) => {
                    const value = formatBankInfo(ba, selEntity?.name);
                    const label = [ba.name, ba.bankName, ba.accountNumber].filter(Boolean).join(' — ');
                    return <option key={idx} value={value}>{label}</option>;
                  })}
                </select>
                <p className="text-xs text-gray-400 mt-1">Leave blank to use entity default.</p>
              </>
            ) : (
              <>
                <textarea
                  value={bankAccountInfo}
                  onChange={(e) => setBankAccountInfo(e.target.value)}
                  rows={3}
                  placeholder="Leave blank to use company default from Settings"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Bank name, account number, SWIFT, etc. Leave blank to use company default.</p>
              </>
            );
          })()}
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

        {/* Signature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="sigSource" checked={sigSource === 'default'} onChange={() => setSigSource('default')} className="text-blue-600" />
              <span className="text-sm text-gray-600">Use entity default</span>
            </label>

            {usersWithSig.length > 0 && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sigSource" checked={sigSource === 'user'} onChange={() => setSigSource('user')} className="text-blue-600" />
                  <span className="text-sm text-gray-600">Use a team member's signature</span>
                </label>
                {sigSource === 'user' && (
                  <div className="ml-6 space-y-2">
                    <select
                      value={selectedSigUser}
                      onChange={(e) => setSelectedSigUser(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select user...</option>
                      {usersWithSig.map((u) => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </select>
                    {selectedSigUser && (() => {
                      const u = users?.find((u) => u._id === selectedSigUser);
                      return u?.signatureUrl ? (
                        <img src={`${import.meta.env.VITE_API_URL || ''}${u.signatureUrl}`} alt="Signature" className="w-40 h-16 object-contain border rounded" />
                      ) : null;
                    })()}
                  </div>
                )}
              </>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="sigSource" checked={sigSource === 'custom'} onChange={() => setSigSource('custom')} className="text-blue-600" />
              <span className="text-sm text-gray-600">Draw / upload custom</span>
            </label>
            {sigSource === 'custom' && (
              <div className="ml-6">
                {signatureUrl ? (
                  <div>
                    <img src={`${import.meta.env.VITE_API_URL || ''}${signatureUrl}`} alt="Signature" className="w-64 h-24 object-contain border rounded mb-2" />
                    <button type="button" onClick={() => setSignatureUrl('')} className="text-sm text-red-600 hover:underline">Clear</button>
                  </div>
                ) : (
                  <div>
                    <div className="border border-gray-300 rounded mb-2" style={{ width: '100%', height: 200 }}>
                      <SignatureCanvas
                        ref={sigCanvas}
                        penColor="black"
                        minWidth={1}
                        maxWidth={3}
                        velocityFilterWeight={0.7}
                        canvasProps={{ style: { width: '100%', height: '100%' } }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={saveSignature} disabled={uploading} className="text-sm text-blue-600 hover:underline">
                        {uploading ? 'Saving...' : 'Save Signature'}
                      </button>
                      <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-sm text-gray-500 hover:underline">Clear Pad</button>
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-gray-500 mr-2">Or upload:</span>
                      <input type="file" accept="image/*" onChange={handleSigUpload} disabled={uploading} className="text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
