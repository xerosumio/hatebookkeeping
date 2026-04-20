import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSettings, useUpdateSettings, useEntities, useCreateEntity, useUpdateEntity, uploadFile } from '../api/hooks';
import { Plus, Trash2, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import type { BankAccount, ChartOfAccount, Entity } from '../types';

const apiUrl = import.meta.env.VITE_API_URL || '';

function resolveUrl(path: string) {
  if (!path) return '';
  return path.startsWith('http') ? path : `${apiUrl}${path}`;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [form, setForm] = useState({
    chartOfAccounts: [] as ChartOfAccount[],
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) {
      setForm({
        chartOfAccounts: settings.chartOfAccounts || [],
      });
    }
  }, [settings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    try {
      await updateSettings.mutateAsync(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update settings');
    }
  }

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <EntityManager />

      <hr className="my-8 border-gray-200" />

      <h2 className="text-lg font-semibold mb-4">Chart of Accounts</h2>
      <p className="text-xs text-gray-400 mb-3">Shared across all entities. Categories used for transactions, payment requests, and reimbursements.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}
        {saved && <div className="bg-green-50 text-green-600 text-sm p-3 rounded">Settings saved.</div>}

        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, chartOfAccounts: [...form.chartOfAccounts, { code: '', name: '', type: 'expense', active: true }] })}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> Add Account
            </button>
          </div>
          {form.chartOfAccounts.length === 0 ? (
            <p className="text-xs text-gray-400">No accounts configured.</p>
          ) : (
            <div className="space-y-2">
              {form.chartOfAccounts.map((acc, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Code</label>}
                    <input
                      type="text"
                      value={acc.code}
                      onChange={(e) => {
                        const updated = [...form.chartOfAccounts];
                        updated[i] = { ...updated[i], code: e.target.value };
                        setForm({ ...form, chartOfAccounts: updated });
                      }}
                      placeholder="5100"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-4">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Name</label>}
                    <input
                      type="text"
                      value={acc.name}
                      onChange={(e) => {
                        const updated = [...form.chartOfAccounts];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setForm({ ...form, chartOfAccounts: updated });
                      }}
                      placeholder="e.g. Salary"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Type</label>}
                    <select
                      value={acc.type}
                      onChange={(e) => {
                        const updated = [...form.chartOfAccounts];
                        updated[i] = { ...updated[i], type: e.target.value as 'income' | 'expense' };
                        setForm({ ...form, chartOfAccounts: updated });
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Active</label>}
                    <label className="flex items-center gap-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={acc.active}
                        onChange={(e) => {
                          const updated = [...form.chartOfAccounts];
                          updated[i] = { ...updated[i], active: e.target.checked };
                          setForm({ ...form, chartOfAccounts: updated });
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">{acc.active ? 'Yes' : 'No'}</span>
                    </label>
                  </div>
                  <div className="col-span-2 flex items-center" style={i === 0 ? { marginTop: 20 } : {}}>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, chartOfAccounts: form.chartOfAccounts.filter((_, idx) => idx !== i) })}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={updateSettings.isPending}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {updateSettings.isPending ? 'Saving...' : 'Save Chart of Accounts'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EntityManager() {
  const { data: entities, isLoading } = useEntities();
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<EntityForm>(emptyEntityForm());
  const [uploading, setUploading] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  function emptyEntityForm(): EntityForm {
    return {
      code: '', name: '', address: '', phone: '', email: '', website: '',
      logoUrl: '', brandColor: '', companyChopUrl: '', signatureUrl: '',
      bankAccounts: [], defaultBankAccountIndex: 0,
    };
  }

  function startEdit(entity: Entity) {
    setExpandedId(expandedId === entity._id ? null : entity._id);
    setForm({
      code: entity.code, name: entity.name, address: entity.address,
      phone: entity.phone, email: entity.email, website: entity.website,
      logoUrl: entity.logoUrl || '', brandColor: entity.brandColor || '',
      companyChopUrl: entity.companyChopUrl || '', signatureUrl: entity.signatureUrl || '',
      bankAccounts: entity.bankAccounts || [], defaultBankAccountIndex: entity.defaultBankAccountIndex || 0,
    });
    setShowNew(false);
    setSaveMsg('');
  }

  function startNew() {
    setExpandedId(null);
    setForm(emptyEntityForm());
    setShowNew(true);
    setSaveMsg('');
  }

  async function handleUpload(file: File, field: keyof EntityForm) {
    setUploading(field);
    try {
      const path = await uploadFile(file);
      setForm((f) => ({ ...f, [field]: path }));
    } catch {
      // ignore
    } finally {
      setUploading('');
    }
  }

  async function handleSave() {
    setSaveMsg('');
    if (expandedId) {
      await updateEntity.mutateAsync({ id: expandedId, data: form });
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } else {
      await createEntity.mutateAsync(form);
      setShowNew(false);
    }
  }

  if (isLoading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 size={20} /> Entities
        </h2>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
          <Plus size={12} /> Add Entity
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Each entity has its own branding, bank accounts, chop, and signature used on quotations, invoices, and receipts.</p>

      <div className="space-y-2 mb-4">
        {entities?.map((entity) => (
          <div key={entity._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => startEdit(entity)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            >
              <div>
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-2">{entity.code}</span>
                <span className="font-medium text-sm">{entity.name}</span>
                {entity.address && <span className="text-xs text-gray-400 ml-2">— {entity.address}</span>}
                {!entity.active && <span className="text-xs text-red-500 ml-2">(Inactive)</span>}
              </div>
              {expandedId === entity._id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>

            {expandedId === entity._id && (
              <div className="border-t border-gray-200 px-4 py-4">
                <EntityFormFields form={form} setForm={setForm} isEdit uploading={uploading} onUpload={handleUpload} />
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={!form.name || updateEntity.isPending}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateEntity.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
                </div>
              </div>
            )}
          </div>
        ))}
        {(!entities || entities.length === 0) && (
          <p className="text-xs text-gray-400">No entities configured.</p>
        )}
      </div>

      {showNew && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">New Entity</h3>
          <EntityFormFields form={form} setForm={setForm} isEdit={false} uploading={uploading} onUpload={handleUpload} />
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.code || !form.name || createEntity.isPending}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createEntity.isPending ? 'Creating...' : 'Create Entity'}
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface EntityForm {
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  brandColor: string;
  companyChopUrl: string;
  signatureUrl: string;
  bankAccounts: BankAccount[];
  defaultBankAccountIndex: number;
}

function EntityFormFields({
  form, setForm, isEdit, uploading, onUpload,
}: {
  form: EntityForm;
  setForm: (fn: EntityForm | ((f: EntityForm) => EntityForm)) => void;
  isEdit: boolean;
  uploading: string;
  onUpload: (file: File, field: keyof EntityForm) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Code *</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="NL"
            disabled={isEdit}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Naton Lab Limited"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Address</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Website</label>
          <input type="text" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Brand Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.brandColor || '#0369a1'}
              onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0"
            />
            <input
              type="text"
              value={form.brandColor}
              onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
              placeholder="#0369a1"
              className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Bank Accounts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-gray-600">Bank Accounts</label>
          <button
            type="button"
            onClick={() => setForm({ ...form, bankAccounts: [...form.bankAccounts, { name: '', bankName: '', accountNumber: '', bankCode: '', branchCode: '', swiftCode: '', location: '' }] })}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {form.bankAccounts.length === 0 ? (
          <p className="text-xs text-gray-400">No bank accounts.</p>
        ) : (
          <div className="space-y-3">
            {form.bankAccounts.map((acc, i) => {
              const updateField = (field: string, value: string) => {
                const updated = [...form.bankAccounts];
                updated[i] = { ...updated[i], [field]: value };
                setForm({ ...form, bankAccounts: updated });
              };
              return (
                <div key={i} className={`border rounded p-3 relative ${form.defaultBankAccountIndex === i ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, defaultBankAccountIndex: i })}
                      className={`text-xs px-2 py-0.5 rounded ${form.defaultBankAccountIndex === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600'}`}
                    >
                      {form.defaultBankAccountIndex === i ? 'Default' : 'Set default'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newAccounts = form.bankAccounts.filter((_, idx) => idx !== i);
                        let newDefault = form.defaultBankAccountIndex;
                        if (i < newDefault) newDefault--;
                        else if (i === newDefault) newDefault = 0;
                        setForm({ ...form, bankAccounts: newAccounts, defaultBankAccountIndex: Math.min(newDefault, Math.max(0, newAccounts.length - 1)) });
                      }}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Account Name *</label>
                      <input type="text" value={acc.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Axilogy Limited" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Account Number</label>
                      <input type="text" value={acc.accountNumber} onChange={(e) => updateField('accountNumber', e.target.value)} placeholder="7950133712" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
                      <input type="text" value={acc.bankName} onChange={(e) => updateField('bankName', e.target.value)} placeholder="DBS Bank (Hong Kong) Limited" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Bank Code</label>
                      <input type="text" value={acc.bankCode || ''} onChange={(e) => updateField('bankCode', e.target.value)} placeholder="016" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Branch Code</label>
                      <input type="text" value={acc.branchCode || ''} onChange={(e) => updateField('branchCode', e.target.value)} placeholder="478" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">SWIFT Code</label>
                      <input type="text" value={acc.swiftCode || ''} onChange={(e) => updateField('swiftCode', e.target.value)} placeholder="DHBKHKHH" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Location</label>
                      <input type="text" value={acc.location || ''} onChange={(e) => updateField('location', e.target.value)} placeholder="Hong Kong SAR" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logo, Chop, Signature */}
      <div className="grid grid-cols-3 gap-4">
        <ImageUploadField
          label="Logo"
          value={form.logoUrl}
          uploading={uploading === 'logoUrl'}
          onUpload={(f) => onUpload(f, 'logoUrl')}
          onClear={() => setForm({ ...form, logoUrl: '' })}
          imgClass="h-16 object-contain"
        />
        <ImageUploadField
          label="Company Chop"
          value={form.companyChopUrl}
          uploading={uploading === 'companyChopUrl'}
          onUpload={(f) => onUpload(f, 'companyChopUrl')}
          onClear={() => setForm({ ...form, companyChopUrl: '' })}
          imgClass="h-20 object-contain"
        />
        <ImageUploadField
          label="Signature"
          value={form.signatureUrl}
          uploading={uploading === 'signatureUrl'}
          onUpload={(f) => onUpload(f, 'signatureUrl')}
          onClear={() => setForm({ ...form, signatureUrl: '' })}
          imgClass="h-14 object-contain"
        />
      </div>
    </div>
  );
}

function ImageUploadField({
  label,
  value,
  uploading,
  onUpload,
  onClear,
  imgClass,
}: {
  label: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  imgClass: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">{label}</label>
      {value ? (
        <div className="space-y-2">
          <img
            src={resolveUrl(value)}
            alt={label}
            className={`${imgClass} rounded border border-gray-200 p-1`}
          />
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-red-500 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">No image</p>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
        className="mt-2 text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full"
      />
      {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
    </div>
  );
}
