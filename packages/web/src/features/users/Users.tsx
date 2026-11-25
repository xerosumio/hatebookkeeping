import { useState } from 'react';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, formatDateTime, type Role, type UserDto } from '@hbk/shared';
import { put, useGet, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, Loading, Modal, Notice, Page, Select, Table } from '../../shared/components/ui';

function EditUser({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const save = useSave(
    () => put(`/users/${user.id}`, { role, active, bankName: user.bankName, bankAccountNumber: user.bankAccountNumber, fpsId: user.fpsId }),
    onClose,
  );

  return (
    <Modal
      title={user.name}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => void save.run()}>
            Save
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-faint">{user.email}</div>
      <Field label="Role" error={save.failure?.fields.role} hint={ROLE_DESCRIPTIONS[role]}>
        <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox label="Can sign in" checked={active} onChange={setActive} />
      {!active ? <div className="text-xs text-ink-faint">Switching this off signs them out everywhere straight away.</div> : null}
      {save.failure ? <Notice tone="error">{save.failure.message}</Notice> : null}
    </Modal>
  );
}

export default function Users() {
  const { me } = useAuth();
  const users = useGet<UserDto[]>('/users');
  const [editing, setEditing] = useState<UserDto | null>(null);

  return (
    <Page title="Users" subtitle="People appear here after their first sign-in. New people start as Staff.">
      <Card padded={false}>
        {users.isPending ? (
          <Loading />
        ) : users.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the users.</Notice>
          </div>
        ) : (
          <Table
            rows={users.data}
            rowKey={(user) => user.id}
            onRowClick={setEditing}
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (user) => (
                  <div>
                    <div className="font-medium">
                      {user.name}
                      {user.id === me?.id ? <span className="text-ink-ghost"> (you)</span> : null}
                    </div>
                    <div className="text-xs text-ink-faint">{user.email}</div>
                  </div>
                ),
              },
              { key: 'role', header: 'Role', cell: (user) => ROLE_LABELS[user.role] },
              { key: 'approver', header: 'Approver', cell: (user) => (user.isApprover ? 'Yes' : '—') },
              { key: 'status', header: 'Status', cell: (user) => <StatusBadge status={user.active ? 'active' : 'inactive'} /> },
              { key: 'seen', header: 'Last sign-in', cell: (user) => (user.lastSignInAt ? formatDateTime(user.lastSignInAt) : 'Never') },
            ]}
          />
        )}
      </Card>
      <div className="text-xs text-ink-faint">Approvers are chosen in Settings.</div>
      {editing ? <EditUser user={editing} onClose={() => setEditing(null)} /> : null}
    </Page>
  );
}
