import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser, uploadFile } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Pencil, X, Check, Ban, KeyRound } from 'lucide-react';

interface EditFormState {
  name: string;
  email: string;
  role: string;
  password: string;
  bankName: string;
  bankAccountNumber: string;
  fpsPhone: string;
  signatureUrl: string;
}

export default function UserList() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', bankName: '', bankAccountNumber: '', fpsPhone: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', email: '', role: '', password: '', bankName: '', bankAccountNumber: '', fpsPhone: '', signatureUrl: '' });
  const [editError, setEditError] = useState('');
  const [sigUploading, setSigUploading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  async function saveDrawnSignature() {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    const dataUrl = sigCanvas.current.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'signature.png', { type: 'image/png' });
    setSigUploading(true);
    try {
      const path = await uploadFile(file);
      setEditForm((prev) => ({ ...prev, signatureUrl: path }));
    } catch {
      setEditError('Signature upload failed');
    } finally {
      setSigUploading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await createUser.mutateAsync(form);
    setForm({ name: '', email: '', password: '', role: 'user', bankName: '', bankAccountNumber: '', fpsPhone: '' });
    setShowAdd(false);
  }

  function startEdit(u: { _id: string; name: string; email: string; role: string; bankName?: string; bankAccountNumber?: string; fpsPhone?: string; signatureUrl?: string }) {
    setEditId(u._id);
    setEditForm({ name: u.name, email: u.email, role: u.role, password: '', bankName: u.bankName || '', bankAccountNumber: u.bankAccountNumber || '', fpsPhone: u.fpsPhone || '', signatureUrl: u.signatureUrl || '' });
    setEditError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setEditError('');
    try {
      const payload: Record<string, string> = { name: editForm.name, email: editForm.email, role: editForm.role, bankName: editForm.bankName, bankAccountNumber: editForm.bankAccountNumber, fpsPhone: editForm.fpsPhone, signatureUrl: editForm.signatureUrl };
      if (editForm.password.trim()) {
        if (editForm.password.length < 8) {
          setEditError('Password must be at least 8 characters');
          return;
        }
        payload.password = editForm.password;
      }
      await updateUser.mutateAsync({ id: editId, data: payload });
      setEditId(null);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update user');
    }
  }

  async function toggleActive(u: { _id: string; active: boolean }) {
    if (u._id === currentUser?.id) return;
    if (u.active) {
      if (!confirm('Deactivate this user?')) return;
      await deactivateUser.mutateAsync(u._id);
    } else {
      await updateUser.mutateAsync({ id: u._id, data: { active: true } });
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
        >
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-5 mb-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">New User</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="text"
              placeholder="Bank name (optional)"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Bank account number (optional)"
              value={form.bankAccountNumber}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="FPS phone number (optional)"
              value={form.fpsPhone}
              onChange={(e) => setForm({ ...form, fpsPhone: e.target.value })}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createUser.isPending}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
          {createUser.isError && (
            <p className="text-sm text-red-600">{(createUser.error as any)?.response?.data?.message || 'Failed to create user'}</p>
          )}
        </form>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !users?.length ? (
        <p className="text-gray-500">No users found.</p>
      ) : (
        <div className="space-y-0">
          {users.map((u) => {
            const isSelf = u._id === currentUser?.id;
            const isEditing = editId === u._id;
            return (
              <div key={u._id} className={`bg-white border border-gray-200 ${isEditing ? 'rounded-lg mb-3' : 'rounded-lg mb-2'} ${!u.active ? 'opacity-50' : ''}`}>
                {isEditing ? (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-700">Edit User</h3>
                      <button onClick={() => setEditId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-100">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Role</label>
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <KeyRound size={12} /> New Password
                        </label>
                        <input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          placeholder="Leave blank to keep current"
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={editForm.bankName}
                          onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                          placeholder="e.g. HSBC"
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Bank Account Number</label>
                        <input
                          type="text"
                          value={editForm.bankAccountNumber}
                          onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                          placeholder="e.g. 400-123456-001"
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">FPS Phone Number</label>
                        <input
                          type="text"
                          value={editForm.fpsPhone}
                          onChange={(e) => setEditForm({ ...editForm, fpsPhone: e.target.value })}
                          placeholder="e.g. +852 9123 4567"
                          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Signature</label>
                        {editForm.signatureUrl ? (
                          <div className="flex items-center gap-3">
                            <img src={`${import.meta.env.VITE_API_URL || ''}${editForm.signatureUrl}`} alt="Signature" className="h-16 object-contain border rounded" />
                            <button type="button" onClick={() => setEditForm({ ...editForm, signatureUrl: '' })} className="text-xs text-red-600 hover:underline">Remove</button>
                          </div>
                        ) : (
                          <div>
                            <div className="border border-gray-300 rounded mb-2" style={{ height: 150 }}>
                              <SignatureCanvas
                                ref={sigCanvas}
                                penColor="black"
                                minWidth={1}
                                maxWidth={3}
                                velocityFilterWeight={0.7}
                                canvasProps={{ style: { width: '100%', height: '100%' } }}
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={saveDrawnSignature} disabled={sigUploading} className="text-sm text-blue-600 hover:underline">
                                {sigUploading ? 'Saving...' : 'Save Signature'}
                              </button>
                              <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-sm text-gray-500 hover:underline">Clear Pad</button>
                              <span className="text-xs text-gray-400">or</span>
                              <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                                Upload image
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={sigUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setSigUploading(true);
                                    try {
                                      const path = await uploadFile(file);
                                      setEditForm((prev) => ({ ...prev, signatureUrl: path }));
                                    } catch {
                                      setEditError('Signature upload failed');
                                    } finally {
                                      setSigUploading(false);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {editError && <p className="text-sm text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={updateUser.isPending}
                        className="flex items-center gap-1 bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Check size={14} /> {updateUser.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-500 hover:underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center px-5 py-3.5">
                    <div className="flex-1 min-w-0 grid grid-cols-6 gap-4 items-center">
                      <div>
                        <p className="font-medium text-sm">{u.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 truncate">{u.email}</p>
                      </div>
                      <div>
                        {u.bankName || u.fpsPhone ? (
                          <div className="text-xs text-gray-500 truncate">
                            {u.fpsPhone && <span>FPS {u.fpsPhone}</span>}
                            {u.fpsPhone && u.bankName && <span> / </span>}
                            {u.bankName && <span>{u.bankName} {u.bankAccountNumber}</span>}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-300">No payment info</p>
                        )}
                      </div>
                      <div>
                        {u.signatureUrl ? (
                          <img src={`${import.meta.env.VITE_API_URL || ''}${u.signatureUrl}`} alt="Signature" className="h-8 max-w-[80px] object-contain" />
                        ) : (
                          <p className="text-xs text-gray-300">No signature</p>
                        )}
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => startEdit(u)}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => toggleActive(u)}
                          className={`p-1.5 rounded ${u.active ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                          title={u.active ? 'Deactivate' : 'Reactivate'}
                        >
                          {u.active ? <Ban size={14} /> : <Check size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        The email configured for each user is used for sending approval notifications from the platform.
      </p>
    </div>
  );
}
