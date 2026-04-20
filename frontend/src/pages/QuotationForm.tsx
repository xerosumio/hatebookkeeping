import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useClients, useCreateClient, useQuotation, useCreateQuotation, useUpdateQuotation, useSettings, useEntities, useUsers, uploadFile } from '../api/hooks';
import LineItemEditor from '../components/LineItemEditor';
import PaymentScheduleEditor from '../components/PaymentScheduleEditor';
import { formatMoney } from '../utils/money';
import type { LineItem, PaymentMilestone } from '../types';

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const sigCanvas = useRef<SignatureCanvas>(null);

  const { data: clients } = useClients();
  const { data: existing } = useQuotation(id || '');
  const { data: settings } = useSettings();
  const { data: entities } = useEntities();
  const { data: users } = useUsers();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const createClient = useCreateClient();

  const [entity, setEntity] = useState('');
  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0, waived: false },
  ]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentMilestone[]>([]);
  const [companyChopUrl, setCompanyChopUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [chopSource, setChopSource] = useState<'custom' | 'default'>('default');
  const [sigSource, setSigSource] = useState<'custom' | 'default' | 'user'>('default');
  const [selectedSigUser, setSelectedSigUser] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', email: '', phone: '', address: '' });

  const [formLoaded, setFormLoaded] = useState(false);
  useEffect(() => {
    if (existing && !formLoaded) {
      setEntity(typeof existing.entity === 'object' ? existing.entity._id : existing.entity);
      setClient(typeof existing.client === 'object' ? existing.client._id : existing.client);
      setTitle(existing.title);
      setLineItems(existing.lineItems);
      setDiscountPercent(existing.discountPercent || 0);
      setTermsAndConditions(existing.termsAndConditions);
      setPaymentSchedule(existing.paymentSchedule);
      if (existing.companyChopUrl) {
        setCompanyChopUrl(existing.companyChopUrl);
        setChopSource('custom');
      }
      if (existing.signatureUrl) {
        setSignatureUrl(existing.signatureUrl);
        setSigSource('custom');
      }
      setValidUntil(existing.validUntil ? existing.validUntil.slice(0, 10) : '');
      setNotes(existing.notes);
      setFormLoaded(true);
    }
  }, [existing, formLoaded]);

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

  // Default to settings.defaultEntityId when creating new
  useEffect(() => {
    if (!isEdit && !entity && settings?.defaultEntityId) {
      setEntity(settings.defaultEntityId);
    }
  }, [isEdit, entity, settings]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const discountCents = Math.round(subtotal * discountPercent / 100);
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
      entity,
      client,
      title,
      lineItems,
      subtotal,
      discount: discountCents,
      discountPercent,
      total,
      termsAndConditions,
      paymentSchedule,
      companyChopUrl: chopSource === 'default' ? '' : companyChopUrl,
      signatureUrl: sigSource === 'default' ? '' : sigSource === 'user' ? (users?.find((u) => u._id === selectedSigUser)?.signatureUrl || '') : signatureUrl,
      validUntil: validUntil || undefined,
      notes,
    };

    try {
      if (isEdit) {
        await updateQuotation.mutateAsync({ id: id!, data });
        navigate(`/quotations/${id}`);
      } else {
        const result = await createQuotation.mutateAsync(data);
        navigate(`/quotations/${result._id}`);
      }
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Client *</label>
              <button
                type="button"
                onClick={() => setShowNewClient(!showNewClient)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {showNewClient ? 'Cancel' : '+ New Client'}
              </button>
            </div>
            {showNewClient ? (
              <div className="space-y-2 border border-gray-200 rounded p-3 bg-gray-50">
                <input
                  type="text"
                  placeholder="Client name *"
                  value={newClientForm.name}
                  onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={!newClientForm.name || createClient.isPending}
                  onClick={async () => {
                    try {
                      const c = await createClient.mutateAsync(newClientForm);
                      setClient(c._id);
                      setShowNewClient(false);
                      setNewClientForm({ name: '', email: '', phone: '', address: '' });
                    } catch {
                      setError('Failed to create client');
                    }
                  }}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 w-full"
                >
                  {createClient.isPending ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            ) : (
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
            )}
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
              <div className="relative">
                <input
                  type="number"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  min={0}
                  max={100}
                  step={1}
                  className="w-20 border border-gray-300 rounded px-2 py-1 pr-6 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
              {discountCents > 0 && <span className="text-gray-400 text-xs">({formatMoney(discountCents)})</span>}
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
          {/* Company Chop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Chop</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="chopSource" checked={chopSource === 'default'} onChange={() => setChopSource('default')} className="text-blue-600" />
                <span className="text-sm text-gray-600">Use company default</span>
              </label>
              {chopSource === 'default' && settings?.companyChopUrl && (
                <img src={`${import.meta.env.VITE_API_URL || ''}${settings.companyChopUrl}`} alt="Default chop" className="w-24 h-24 object-contain border rounded ml-6" />
              )}
              {chopSource === 'default' && !settings?.companyChopUrl && (
                <p className="text-xs text-gray-400 ml-6">No default chop configured in Settings.</p>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="chopSource" checked={chopSource === 'custom'} onChange={() => setChopSource('custom')} className="text-blue-600" />
                <span className="text-sm text-gray-600">Upload custom</span>
              </label>
              {chopSource === 'custom' && (
                <div className="ml-6">
                  {companyChopUrl && (
                    <img src={companyChopUrl} alt="Company chop" className="w-24 h-24 object-contain border rounded mb-2" />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setCompanyChopUrl)} className="text-sm" />
                </div>
              )}
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sigSource" checked={sigSource === 'default'} onChange={() => setSigSource('default')} className="text-blue-600" />
                <span className="text-sm text-gray-600">Use company default</span>
              </label>
              {sigSource === 'default' && settings?.signatureUrl && (
                <img src={`${import.meta.env.VITE_API_URL || ''}${settings.signatureUrl}`} alt="Default signature" className="w-40 h-16 object-contain border rounded ml-6" />
              )}
              {sigSource === 'default' && !settings?.signatureUrl && (
                <p className="text-xs text-gray-400 ml-6">No default signature configured in Settings.</p>
              )}
              {(users?.filter((u) => u.active && u.signatureUrl) || []).length > 0 && (
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
                        {users?.filter((u) => u.active && u.signatureUrl).map((u) => (
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
                      <img src={signatureUrl} alt="Signature" className="w-64 h-24 object-contain border rounded mb-2" />
                      <button type="button" onClick={() => setSignatureUrl('')} className="text-sm text-red-600 hover:underline">
                        Clear
                      </button>
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
                        <button type="button" onClick={saveSignature} className="text-sm text-blue-600 hover:underline">Save Signature</button>
                        <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-sm text-gray-500 hover:underline">Clear Pad</button>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm text-gray-500 mr-2">Or upload:</span>
                        <input type="file" accept="image/*" onChange={(e) => handleUpload(e, setSignatureUrl)} className="text-sm" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
