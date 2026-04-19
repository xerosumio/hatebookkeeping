import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCreatePaymentRequest, useUpdatePaymentRequest, usePaymentRequest,
  usePayees, useCreatePayee, useSettings, uploadFile,
} from '../api/hooks';
import { formatMoney, decimalToCents, centsToDecimal } from '../utils/money';
import { Plus, X, Upload, Trash2 } from 'lucide-react';
import type { Payee } from '../types';


interface ItemRow {
  payee: string;
  description: string;
  amount: string;
  category: string;
  recipient: string;
}

const emptyItem = (): ItemRow => ({ payee: '', description: '', amount: '', category: '', recipient: '' });

export default function PaymentRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const createRequest = useCreatePaymentRequest();
  const updateRequest = useUpdatePaymentRequest();
  const { data: existing, isLoading: loadingExisting } = usePaymentRequest(id || '');
  const { data: payees } = usePayees();
  const { data: settings } = useSettings();
  const expenseCategories = (settings?.chartOfAccounts || []).filter((a) => a.active && a.type === 'expense');
  const createPayee = useCreatePayee();

  const [description, setDescription] = useState('');
  const [sourceBankAccount, setSourceBankAccount] = useState('');
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const [showNewPayee, setShowNewPayee] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newPayeeBank, setNewPayeeBank] = useState('');
  const [newPayeeAccount, setNewPayeeAccount] = useState('');

  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setDescription(existing.description || '');
      setSourceBankAccount(existing.sourceBankAccount || '');
      setAttachments(existing.attachments || []);
      setItems(
        existing.items.map((item) => ({
          payee: typeof item.payee === 'object' ? (item.payee as Payee)._id : (item.payee as string),
          description: item.description,
          amount: String(centsToDecimal(item.amount)),
          category: item.category,
          recipient: item.recipient || '',
        })),
      );
      setLoaded(true);
    }
  }, [isEdit, existing, loaded]);

  function updateItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, ...patch } : item));
  }

  function removeItem(i: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((sum, item) => sum + decimalToCents(Number(item.amount) || 0), 0);

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const path = await uploadFile(file);
        urls.push(path);
      }
      setAttachments((prev) => [...prev, ...urls]);
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  async function handleCreatePayee() {
    if (!newPayeeName.trim()) return;
    try {
      const p = await createPayee.mutateAsync({
        name: newPayeeName,
        bankName: newPayeeBank,
        bankAccountNumber: newPayeeAccount,
      });
      setShowNewPayee(false);
      setNewPayeeName('');
      setNewPayeeBank('');
      setNewPayeeAccount('');
      if (items.length === 1 && !items[0].payee) {
        updateItem(0, { payee: p._id });
      }
    } catch {
      setError('Failed to create payee');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const validItems = items.filter((item) => item.payee && item.description && Number(item.amount) > 0);
    if (!validItems.length) {
      setError('Add at least one transfer item');
      return;
    }

    const payload = {
      description,
      sourceBankAccount,
      items: validItems.map((item) => ({
        payee: item.payee,
        description: item.description,
        amount: decimalToCents(Number(item.amount)),
        category: item.category,
        recipient: item.recipient,
      })),
      attachments,
    };

    try {
      if (isEdit) {
        await updateRequest.mutateAsync({ id, data: payload });
        navigate(`/payment-requests/${id}`);
      } else {
        await createRequest.mutateAsync(payload as any);
        navigate('/payment-requests');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} payment request`);
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const isPending = createRequest.isPending || updateRequest.isPending;

  if (isEdit && loadingExisting) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Payment Request' : 'New Payment Request'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. April transfers batch"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Bank Account</label>
            <select
              value={sourceBankAccount}
              onChange={(e) => setSourceBankAccount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select account...</option>
              {settings?.bankAccounts?.map((acc, i) => (
                <option key={i} value={acc.name}>
                  {acc.name}{acc.bankName ? ` (${acc.bankName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Transfer Items</label>
            <button
              type="button"
              onClick={() => setShowNewPayee(!showNewPayee)}
              className="text-xs text-green-600 hover:text-green-700"
            >
              + New Payee
            </button>
          </div>

          {showNewPayee && (
            <div className="border border-green-200 rounded p-3 bg-green-50 mb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={newPayeeName} onChange={(e) => setNewPayeeName(e.target.value)} placeholder="Payee name *" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                <input type="text" value={newPayeeBank} onChange={(e) => setNewPayeeBank(e.target.value)} placeholder="Bank name" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                <input type="text" value={newPayeeAccount} onChange={(e) => setNewPayeeAccount(e.target.value)} placeholder="Account number" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCreatePayee} disabled={!newPayeeName.trim() || createPayee.isPending} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50">
                  {createPayee.isPending ? 'Creating...' : 'Create Payee'}
                </button>
                <button type="button" onClick={() => setShowNewPayee(false)} className="text-xs text-gray-500">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Payee</label>}
                  <select value={item.payee} onChange={(e) => updateItem(i, { payee: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Select...</option>
                    {payees?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                  <input type="text" value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="What for" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Category</label>}
                  <select value={item.category} onChange={(e) => updateItem(i, { category: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Select...</option>
                    {expenseCategories.map((a) => <option key={a.code} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Recipient</label>}
                  <input type="text" value={item.recipient} onChange={(e) => updateItem(i, { recipient: e.target.value })} placeholder="Internal member" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs text-gray-500 mb-1">Amount</label>}
                  <input type="number" value={item.amount} onChange={(e) => updateItem(i, { amount: e.target.value })} min={0.01} step={0.01} placeholder="0.00" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right" />
                </div>
                <div className="col-span-1 flex justify-center" style={i === 0 ? { marginTop: 20 } : {}}>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setItems((prev) => [...prev, emptyItem()])} className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
            <Plus size={14} /> Add item
          </button>

          <div className="text-right mt-3 text-sm font-bold">
            Total: <span className="font-mono tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
          {attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {attachments.map((url, i) => {
                const filename = url.split('/').pop() || url;
                return (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
                    <a href={url.startsWith('http') ? url : `${apiUrl}${url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate flex-1">{filename}</a>
                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-700">
            <Upload size={14} />
            <span>{uploading ? 'Uploading...' : 'Add files'}</span>
            <input type="file" multiple onChange={(e) => handleFileUpload(e.target.files)} disabled={uploading} className="hidden" />
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button type="submit" disabled={isPending || uploading} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Submit for Approval'}
          </button>
          <button type="button" onClick={() => navigate(isEdit ? `/payment-requests/${id}` : '/payment-requests')} className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
