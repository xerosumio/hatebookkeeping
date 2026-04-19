import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useCreateReimbursement, useUpdateReimbursement, useReimbursement,
  useUsers, uploadFile,
} from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney, decimalToCents, centsToDecimal } from '../utils/money';
import { Plus, Trash2, Upload } from 'lucide-react';

interface ItemRow {
  date: string;
  description: string;
  amount: string;
  category: string;
  receiptUrl: string;
  notes: string;
}

const emptyItem = (): ItemRow => ({
  date: new Date().toISOString().slice(0, 10),
  description: '',
  amount: '',
  category: '',
  receiptUrl: '',
  notes: '',
});

export default function ReimbursementForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const createReimbursement = useCreateReimbursement();
  const updateReimbursement = useUpdateReimbursement();
  const { data: existing, isLoading: loadingExisting } = useReimbursement(id || '');
  const { data: users } = useUsers();

  const REIMBURSEMENT_CATEGORY = 'Reimbursement';

  const [title, setTitle] = useState('');
  const [onBehalfOfUserId, setOnBehalfOfUserId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const currentUserFresh = users?.find((u) => u._id === user?.id);
  const selectedUser = isAdmin && onBehalfOfUserId
    ? users?.find((u) => u._id === onBehalfOfUserId)
    : null;

  const targetUser = selectedUser || currentUserFresh;
  const claimantName = targetUser?.name || user?.name || '';
  const claimantPayment = {
    bankName: targetUser?.bankName || '',
    bankAccountNumber: targetUser?.bankAccountNumber || '',
    fpsPhone: targetUser?.fpsPhone || '',
  };
  const hasBankDetails = !!claimantPayment.fpsPhone || (!!claimantPayment.bankName && !!claimantPayment.bankAccountNumber);

  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setTitle(existing.title || '');
      setNotes(existing.notes || '');
      setItems(
        existing.items.map((item) => ({
          date: item.date.slice(0, 10),
          description: item.description,
          amount: String(centsToDecimal(item.amount)),
          category: item.category,
          receiptUrl: item.receiptUrl || '',
          notes: item.notes || '',
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

  async function handleReceiptUpload(i: number, file: File) {
    setUploadingIdx(i);
    try {
      const path = await uploadFile(file);
      updateItem(i, { receiptUrl: path });
    } catch {
      setError('Failed to upload receipt');
    } finally {
      setUploadingIdx(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!hasBankDetails) {
      setError('Payment details are missing. Please ask an admin to configure FPS / bank details in User Management.');
      return;
    }

    const validItems = items.filter((item) => item.description && Number(item.amount) > 0);
    if (!validItems.length) {
      setError('Add at least one expense item with description and amount');
      return;
    }

    const payload: { title: string; onBehalfOfUserId?: string; items: any[]; notes: string } = {
      title,
      items: validItems.map((item) => ({
        date: item.date,
        description: item.description,
        amount: decimalToCents(Number(item.amount)),
        category: REIMBURSEMENT_CATEGORY,
        receiptUrl: item.receiptUrl,
        notes: item.notes,
      })),
      notes,
    };

    if (isAdmin && onBehalfOfUserId) {
      payload.onBehalfOfUserId = onBehalfOfUserId;
    }

    try {
      if (isEdit) {
        await updateReimbursement.mutateAsync({ id, data: payload });
        navigate(`/reimbursements/${id}`);
      } else {
        const created = await createReimbursement.mutateAsync(payload);
        navigate(`/reimbursements/${created._id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'submit'} reimbursement`);
    }
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';
  const isPending = createReimbursement.isPending || updateReimbursement.isPending;

  if (isEdit && loadingExisting) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Reimbursement' : 'New Reimbursement Claim'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Client meeting expenses"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claimant</label>
            {isAdmin ? (
              <select
                value={onBehalfOfUserId}
                onChange={(e) => setOnBehalfOfUserId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Myself ({user?.name})</option>
                {users?.filter((u) => u._id !== user?.id && u.active).map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
            ) : (
              <div className="border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-700 font-medium">
                {user?.name}
              </div>
            )}
          </div>
        </div>

        {hasBankDetails ? (
          <div className="text-xs text-gray-500">
            Reimburse to: <span className="font-medium text-gray-700">{claimantName}</span>
            <span> (
              {claimantPayment.fpsPhone && `FPS ${claimantPayment.fpsPhone}`}
              {claimantPayment.fpsPhone && claimantPayment.bankName && ' / '}
              {claimantPayment.bankName && `${claimantPayment.bankName} ${claimantPayment.bankAccountNumber}`}
            )</span>
          </div>
        ) : (
          <div className="border border-amber-200 rounded p-4 bg-amber-50">
            <p className="text-sm text-amber-800">
              No payment details found for <strong>{claimantName}</strong>. Please ask an admin to configure FPS / bank details in{' '}
              <span className="font-semibold">User Management</span>.
            </p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Expense Items</label>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded p-3 bg-gray-50">
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Date</label>}
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateItem(i, { date: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-5">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="What was the expense for"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Amount</label>}
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateItem(i, { amount: e.target.value })}
                      min={0.01}
                      step={0.01}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    {i === 0 && <label className="block text-xs text-gray-500 mb-1">Receipt</label>}
                    {item.receiptUrl ? (
                      <div className="flex items-center gap-1">
                        <a
                          href={item.receiptUrl.startsWith('http') ? item.receiptUrl : `${apiUrl}${item.receiptUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate"
                        >
                          View
                        </a>
                        <button type="button" onClick={() => updateItem(i, { receiptUrl: '' })} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1 cursor-pointer text-xs text-blue-600 hover:text-blue-700">
                        <Upload size={12} />
                        <span>{uploadingIdx === i ? 'Uploading...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReceiptUpload(i, file);
                          }}
                          disabled={uploadingIdx !== null}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center" style={i === 0 ? { marginTop: 20 } : {}}>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateItem(i, { notes: e.target.value })}
                    placeholder="Notes (optional)"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-600"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Add expense item
          </button>

          <div className="text-right mt-3 text-sm font-bold">
            Total: <span className="font-mono tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional notes..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isPending || uploadingIdx !== null}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Submitting...' : isEdit ? 'Save Changes' : 'Submit & Send for Approval'}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/reimbursements/${id}` : '/reimbursements')}
            className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {!isEdit && (
          <p className="text-xs text-gray-400">All admins will be notified by email automatically upon submission.</p>
        )}
      </form>
    </div>
  );
}
