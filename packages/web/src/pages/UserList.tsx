import { useEffect, useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { USER_PAGE_IDS, USER_PAGE_LABELS, type UserPageId } from '@hbk/shared';
import { useUsers, useUpdateUser, useDeactivateUser, useInviteUser, useDeleteUser, useUserAccess, useUpdateUserAccess, uploadFile } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { Pencil, X, Check, Ban, Trash2 } from 'lucide-react';

interface EditFormState {
  name: string;
  email: string;
  role: string;
  bankName: string;
  bankAccountNumber: string;
  fpsPhone: string;
  signatureUrl: string;
}

export default function UserList() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();
  const inviteUser = useInviteUser();
  const deleteUser = useDeleteUser();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'user' });
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', email: '', role: '', bankName: '', bankAccountNumber: '', fpsPhone: '', signatureUrl: '' });
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

  function startEdit(u: { _id: string; name: string; email: string; role: string; bankName?: string; bankAccountNumber?: string; fpsPhone?: string; signatureUrl?: string }) {
    setEditId(u._id);
    setEditForm({ name: u.name, email: u.email, role: u.role, bankName: u.bankName || '', bankAccountNumber: u.bankAccountNumber || '', fpsPhone: u.fpsPhone || '', signatureUrl: u.signatureUrl || '' });
    setEditError('');
  }

  async function saveEdit() {
    if (!editId) return;
    setEditError('');
    try {
      const payload: Record<string, string> = { name: editForm.name, email: editForm.email, role: editForm.role, bankName: editForm.bankName, bankAccountNumber: editForm.bankAccountNumber, fpsPhone: editForm.fpsPhone, signatureUrl: editForm.signatureUrl };
      await updateUser.mutateAsync({ id: editId, data: payload });
      setEditId(null);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update user');
    }
  }

  async function sendInvite() {
    setInviteError('');
    setInviteNotice('');
    try {
      const result = await inviteUser.mutateAsync(inviteForm);
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'user' });
      setInviteNotice(
        result.email === 'sent'
          ? `Invited ${result.user.name}. A sign-in link was emailed to them.`
          : `Invited ${result.user.name}. The email was not sent, so tell them to sign in with Authentik using ${result.user.email}.`,
      );
    } catch (err: any) {
      setInviteError(err?.response?.data?.error || 'Could not invite user');
    }
  }

  async function removeUser(u: { _id: string; name: string }) {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setInviteNotice('');
    try {
      await deleteUser.mutateAsync(u._id);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Could not delete user');
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Invite someone by email, or they appear on first Authentik sign-in with that address.</p>
        </div>
        <button
          type="button"
          onClick={() => { setInviteOpen(true); setInviteError(''); }}
          className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded"
        >
          Invite
        </button>
      </div>
      {inviteNotice && <p className="text-sm text-green-700 mb-4">{inviteNotice}</p>}

      <AccessPolicy users={users || []} />

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
                        <>
                          <button
                            onClick={() => toggleActive(u)}
                            className={`p-1.5 rounded ${u.active ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                            title={u.active ? 'Deactivate' : 'Reactivate'}
                          >
                            {u.active ? <Ban size={14} /> : <Check size={14} />}
                          </button>
                          <button
                            onClick={() => removeUser(u)}
                            className="p-1.5 rounded text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
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

      {inviteOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-1">Invite user</h3>
            <p className="text-xs text-gray-500 mb-4">They sign in with Authentik using this email. The invite does not create an Authentik account.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {inviteError && <p className="text-xs text-red-600 mt-2">{inviteError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={sendInvite}
                disabled={!inviteForm.name || !inviteForm.email || inviteUser.isPending}
                className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
              >
                {inviteUser.isPending ? 'Inviting…' : 'Send invite'}
              </button>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccessPolicy({ users }: { users: { _id: string; name: string; email: string; active: boolean; role: string }[] }) {
  const { data, isLoading } = useUserAccess();
  const save = useUpdateUserAccess();
  const [pages, setPages] = useState<UserPageId[]>([]);
  const [seeAllReimbursements, setSeeAllReimbursements] = useState(false);
  const [approve, setApprove] = useState(false);
  const [adjustFund, setAdjustFund] = useState(false);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPages(data.pages);
    setSeeAllReimbursements(data.seeAllReimbursements);
    setApprove(data.approve);
    setAdjustFund(data.adjustFund);
    setApproverIds(data.approverIds);
  }, [data]);

  function togglePage(id: UserPageId) {
    setSaved(false);
    setPages((current) => current.includes(id) ? current.filter((page) => page !== id) : [...current, id]);
  }

  function toggleApprover(id: string) {
    setSaved(false);
    setApproverIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function onSave() {
    setError('');
    setSaved(false);
    try {
      await save.mutateAsync({ pages, seeAllReimbursements, approve, adjustFund, approverIds });
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not save access');
    }
  }

  const activeUsers = users.filter((user) => user.active);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Regular user access</h2>
        <p className="text-xs text-gray-500 mt-1">
          One set of pages and functions for everyone who is not an admin. Admins keep full access.
          Users, Settings, Bank Balance, Endpoint, and Agent Guide stay admin-only.
        </p>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-gray-500">Loading access…</p>
      ) : (
        <>
          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-2">Pages</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {USER_PAGE_IDS.map((id) => (
                <label key={id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={pages.includes(id)}
                    onChange={() => togglePage(id)}
                  />
                  {USER_PAGE_LABELS[id]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-2">Functions</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={seeAllReimbursements} onChange={(e) => { setSaved(false); setSeeAllReimbursements(e.target.checked); }} />
                See every reimbursement
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={approve} onChange={(e) => { setSaved(false); setApprove(e.target.checked); }} />
                Approve an expense or quotation
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={adjustFund} onChange={(e) => { setSaved(false); setAdjustFund(e.target.checked); }} />
                Adjust an Airwallex fund to the live bank balance
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-1">Required approvers</h3>
            <p className="text-xs text-gray-500 mb-2">
              Everyone selected must approve before an expense or quotation is approved. A selected person can approve even when the approve switch above is off. If nobody is selected, one approval from someone allowed to approve is enough.
            </p>
            <div className="space-y-2">
              {activeUsers.map((person) => (
                <label key={person._id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={approverIds.includes(person._id)}
                    onChange={() => toggleApprover(person._id)}
                  />
                  {person.name}
                  <span className="text-xs text-gray-400">{person.role === 'admin' ? 'Admin' : 'User'}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={save.isPending}
              className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save access'}
            </button>
            {saved && <span className="text-xs text-green-600">Saved</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
