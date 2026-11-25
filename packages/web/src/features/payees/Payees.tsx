import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { payeeInputSchema, type PayeeDto } from '@hbk/shared';
import { del, post, put, useGet, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, FormGrid, Input, Loading, Modal, Notice, Page, Table, Textarea } from '../../shared/components/ui';
import { useFormSave } from '../../shared/form';

type Form = Omit<PayeeDto, 'id' | 'archived'>;
const EMPTY: Form = { name: '', bankName: '', bankAccountNumber: '', bankCode: '', fpsId: '', notes: '' };

function PayeeDialog({ payee, canManage, onClose }: { payee: PayeeDto | null; canManage: boolean; onClose: () => void }) {
  const [form, setForm] = useState<Form>(payee ?? EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const build = useCallback(() => form, [form]);
  const send = useCallback((value: Form) => (payee ? put(`/payees/${payee.id}`, value) : post('/payees', value)), [payee]);
  const save = useFormSave(payeeInputSchema, build, send, onClose);
  const archive = useSave(() => post(`/payees/${payee!.id}/${payee!.archived ? 'restore' : 'archive'}`), onClose);
  const remove = useSave(() => del(`/payees/${payee!.id}`), onClose);

  const text = (key: keyof Form) => ({
    value: form[key],
    disabled: !canManage,
    invalid: !!save.errors[key],
    onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <Modal
      title={payee ? payee.name : 'Add a payee'}
      onClose={onClose}
      footer={
        canManage ? (
          <>
            {payee ? (
              <>
                <Button variant="ghost" busy={archive.busy} onClick={() => void archive.run()}>
                  {payee.archived ? 'Restore' : 'Archive'}
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
        <Field label="Bank" error={save.errors.bankName}>
          <Input {...text('bankName')} />
        </Field>
        <Field label="Bank code" error={save.errors.bankCode}>
          <Input {...text('bankCode')} />
        </Field>
        <Field label="Account number" error={save.errors.bankAccountNumber}>
          <Input {...text('bankAccountNumber')} />
        </Field>
        <Field label="FPS ID" error={save.errors.fpsId}>
          <Input {...text('fpsId')} />
        </Field>
      </FormGrid>
      <Field label="Notes" error={save.errors.notes}>
        <Textarea {...text('notes')} rows={2} />
      </Field>
      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      {archive.failure ? <Notice tone="error">{archive.failure.message}</Notice> : null}
      {confirmDelete && payee ? (
        <ConfirmDialog
          title={`Delete ${payee.name}?`}
          confirmLabel="Delete"
          danger
          busy={remove.busy}
          failure={remove.failure}
          onConfirm={() => void remove.run()}
          onClose={() => setConfirmDelete(false)}
        >
          A payee that appears on an expense cannot be deleted, only archived.
        </ConfirmDialog>
      ) : null}
    </Modal>
  );
}

export default function Payees() {
  const { can } = useAuth();
  const payees = useGet<PayeeDto[]>('/payees');
  const [editing, setEditing] = useState<PayeeDto | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const canManage = can('payees.manage');
  const rows = (payees.data ?? []).filter((payee) => showArchived || !payee.archived);

  return (
    <Page
      title="Payees"
      subtitle="The suppliers and people you pay expenses to."
      actions={
        canManage ? (
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Add payee
          </Button>
        ) : null
      }
    >
      <Card padded={false} title={<Checkbox label="Show archived" checked={showArchived} onChange={setShowArchived} />}>
        {payees.isPending ? (
          <Loading />
        ) : payees.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the payees.</Notice>
          </div>
        ) : (
          <Table
            rows={rows}
            rowKey={(payee) => payee.id}
            onRowClick={setEditing}
            empty="No payees yet. Add one before entering an expense."
            columns={[
              { key: 'name', header: 'Name', cell: (payee) => <span className="font-medium">{payee.name}</span> },
              { key: 'bank', header: 'Bank', cell: (payee) => payee.bankName || '—' },
              { key: 'account', header: 'Account', cell: (payee) => payee.bankAccountNumber || '—' },
              { key: 'fps', header: 'FPS ID', cell: (payee) => payee.fpsId || '—' },
              { key: 'status', header: '', cell: (payee) => (payee.archived ? <StatusBadge status="archived" /> : null) },
            ]}
          />
        )}
      </Card>
      {editing ? <PayeeDialog payee={editing === 'new' ? null : editing} canManage={canManage} onClose={() => setEditing(null)} /> : null}
    </Page>
  );
}
