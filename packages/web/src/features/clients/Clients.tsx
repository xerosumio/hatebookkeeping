import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { clientInputSchema, type ClientDto } from '@hbk/shared';
import { del, post, put, useGet, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, FormGrid, Input, Loading, Modal, Notice, Page, Table, Textarea } from '../../shared/components/ui';
import { useFormSave } from '../../shared/form';

type Form = Omit<ClientDto, 'id' | 'archived'>;
const EMPTY: Form = { name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' };

function ClientDialog({ client, canManage, onClose }: { client: ClientDto | null; canManage: boolean; onClose: () => void }) {
  const [form, setForm] = useState<Form>(client ?? EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const build = useCallback(() => form, [form]);
  const send = useCallback((value: Form) => (client ? put(`/clients/${client.id}`, value) : post('/clients', value)), [client]);
  const save = useFormSave(clientInputSchema, build, send, onClose);
  const archive = useSave(() => post(`/clients/${client!.id}/${client!.archived ? 'restore' : 'archive'}`), onClose);
  const remove = useSave(() => del(`/clients/${client!.id}`), onClose);

  const text = (key: keyof Form) => ({
    value: form[key],
    disabled: !canManage,
    invalid: !!save.errors[key],
    onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <Modal
      title={client ? client.name : 'Add a client'}
      onClose={onClose}
      footer={
        canManage ? (
          <>
            {client ? (
              <>
                <Button variant="ghost" busy={archive.busy} onClick={() => void archive.run()}>
                  {client.archived ? 'Restore' : 'Archive'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
                <span className="flex-1" />
              </>
            ) : null}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <Field label="Name" error={save.errors.name}>
        <Input {...text('name')} autoFocus />
      </Field>
      <FormGrid>
        <Field label="Contact person" error={save.errors.contactPerson}>
          <Input {...text('contactPerson')} />
        </Field>
        <Field label="Email" error={save.errors.email}>
          <Input {...text('email')} />
        </Field>
        <Field label="Phone" error={save.errors.phone}>
          <Input {...text('phone')} />
        </Field>
      </FormGrid>
      <Field label="Address" error={save.errors.address} hint="Printed on quotes and invoices.">
        <Textarea {...text('address')} rows={2} />
      </Field>
      <Field label="Notes" error={save.errors.notes}>
        <Textarea {...text('notes')} rows={2} />
      </Field>
      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      {archive.failure ? <Notice tone="error">{archive.failure.message}</Notice> : null}
      {confirmDelete && client ? (
        <ConfirmDialog
          title={`Delete ${client.name}?`}
          confirmLabel="Delete"
          danger
          busy={remove.busy}
          failure={remove.failure}
          onConfirm={() => void remove.run()}
          onClose={() => setConfirmDelete(false)}
        >
          A client that appears on a quote or invoice cannot be deleted, only archived.
        </ConfirmDialog>
      ) : null}
    </Modal>
  );
}

export default function Clients() {
  const { can } = useAuth();
  const clients = useGet<ClientDto[]>('/clients');
  const [editing, setEditing] = useState<ClientDto | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const canManage = can('clients.manage');
  const rows = (clients.data ?? []).filter((client) => showArchived || !client.archived);

  return (
    <Page
      title="Clients"
      actions={
        canManage ? (
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Add client
          </Button>
        ) : null
      }
    >
      <Card padded={false} title={<Checkbox label="Show archived" checked={showArchived} onChange={setShowArchived} />}>
        {clients.isPending ? (
          <Loading />
        ) : clients.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the clients.</Notice>
          </div>
        ) : (
          <Table
            rows={rows}
            rowKey={(client) => client.id}
            onRowClick={setEditing}
            empty="No clients yet. Add the people and companies you send quotes and invoices to."
            columns={[
              { key: 'name', header: 'Name', cell: (client) => <span className="font-medium">{client.name}</span> },
              { key: 'contact', header: 'Contact', cell: (client) => client.contactPerson || '—' },
              { key: 'email', header: 'Email', cell: (client) => client.email || '—' },
              { key: 'phone', header: 'Phone', cell: (client) => client.phone || '—' },
              { key: 'status', header: '', cell: (client) => (client.archived ? <StatusBadge status="archived" /> : null) },
            ]}
          />
        )}
      </Card>
      {editing ? <ClientDialog client={editing === 'new' ? null : editing} canManage={canManage} onClose={() => setEditing(null)} /> : null}
    </Page>
  );
}
