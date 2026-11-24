import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { centsToInput, formatDate, formatMoney, hkToday, otherIncomeInputSchema, type OtherIncomeDto, type OtherIncomeInput } from '@hbk/shared';
import { del, post, put, useGet, useSave } from '../../shared/api/hooks';
import { CompanyField, useCompanies } from '../../shared/company';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { CategorySelect } from '../../shared/components/pickers';
import { Button, Card, Field, FormGrid, Input, Loading, Modal, MoneyInput, Notice, Page, Table, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';

function EntryDialog({ entry, onClose }: { entry: OtherIncomeDto | null; onClose: () => void }) {
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(entry?.company.id ?? defaultId);
  const [date, setDate] = useState(entry?.date ?? hkToday());
  const [description, setDescription] = useState(entry?.description ?? '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '');
  const [amount, setAmount] = useState(entry ? centsToInput(entry.amount) : '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const build = useCallback(
    () => ({ companyId: companyId || defaultId, date, description, categoryId, amount: centsOf(amount), notes }),
    [companyId, defaultId, date, description, categoryId, amount, notes],
  );
  const send = useCallback((value: OtherIncomeInput) => (entry ? put(`/other-income/${entry.id}`, value) : post('/other-income', value)), [entry]);
  const save = useFormSave(otherIncomeInputSchema, build, send, onClose);
  const remove = useSave(() => del(`/other-income/${entry!.id}`), onClose);

  return (
    <Modal
      title={entry ? 'Other income' : 'Add other income'}
      onClose={onClose}
      footer={
        <>
          {entry ? (
            <>
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
      }
    >
      <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} />
      <Field label="Description" error={save.errors.description}>
        <Input value={description} invalid={!!save.errors.description} autoFocus onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <FormGrid>
        <Field label="Date received" error={save.errors.date}>
          <Input type="date" max={hkToday()} value={date} invalid={!!save.errors.date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Amount" error={save.errors.amount}>
          <MoneyInput value={amount} invalid={!!save.errors.amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Category" error={save.errors.categoryId}>
        <CategorySelect type="income" value={categoryId} invalid={!!save.errors.categoryId} onChange={setCategoryId} />
      </Field>
      <Field label="Notes" error={save.errors.notes}>
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
      {confirmDelete ? (
        <ConfirmDialog title="Delete this entry?" confirmLabel="Delete" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={() => setConfirmDelete(false)}>
          It will no longer count in the P&amp;L.
        </ConfirmDialog>
      ) : null}
    </Modal>
  );
}

export default function OtherIncome() {
  const { selectedId, companies } = useCompanies();
  const entries = useGet<OtherIncomeDto[]>('/other-income', { companyId: selectedId });
  const [editing, setEditing] = useState<OtherIncomeDto | 'new' | null>(null);

  return (
    <Page
      title="Other income"
      subtitle="Money received that is not from an invoice, such as bank interest, a grant or a refund."
      actions={
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
          Add other income
        </Button>
      }
    >
      <Card padded={false}>
        {entries.isPending ? (
          <Loading />
        ) : entries.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load other income.</Notice>
          </div>
        ) : (
          <Table
            rows={entries.data}
            rowKey={(entry) => entry.id}
            onRowClick={setEditing}
            empty="Nothing entered yet."
            columns={[
              { key: 'date', header: 'Date received', cell: (entry) => formatDate(entry.date) },
              { key: 'description', header: 'Description', cell: (entry) => <span className="font-medium">{entry.description}</span> },
              { key: 'category', header: 'Category', cell: (entry) => entry.categoryName },
              ...(companies.length > 1 ? [{ key: 'company', header: 'Company', cell: (entry: OtherIncomeDto) => entry.company.name }] : []),
              { key: 'amount', header: 'Amount', align: 'right', cell: (entry) => formatMoney(entry.amount) },
            ]}
          />
        )}
      </Card>
      {editing ? <EntryDialog entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Page>
  );
}
