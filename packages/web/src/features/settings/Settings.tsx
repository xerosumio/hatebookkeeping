import { useState } from 'react';
import { Plus } from 'lucide-react';
import { APPROVER_ROLES, ROLE_LABELS, type ApprovalSettingsDto, type CategoryDto, type CategoryType, type CompanyDto, type UserDto } from '@hbk/shared';
import { post, put, useGet, useSave } from '../../shared/api/hooks';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, Input, Loading, Modal, Notice, Page, Select, Table } from '../../shared/components/ui';
import { CompanyForm } from './CompanyForm';

function Companies() {
  const companies = useGet<CompanyDto[]>('/companies');
  const [editing, setEditing] = useState<CompanyDto | 'new' | null>(null);
  return (
    <Card
      title="Companies"
      padded={false}
      right={
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>
          Add company
        </Button>
      }
    >
      {companies.isPending ? (
        <Loading />
      ) : (
        <Table
          rows={companies.data ?? []}
          rowKey={(company) => company.id}
          onRowClick={setEditing}
          empty="Add your first company. Its name, bank details, chop and signature appear on quotes, invoices and receipts."
          columns={[
            { key: 'name', header: 'Name', cell: (company) => <span className="font-medium">{company.name}</span> },
            { key: 'code', header: 'Code', cell: (company) => company.code },
            { key: 'bank', header: 'Bank details', cell: (company) => (company.bankDetails ? 'Set' : <span className="text-signal">Missing</span>) },
            { key: 'chop', header: 'Chop & signature', cell: (company) => (company.chopFileId && company.signatureFileId ? 'Set' : <span className="text-signal">Missing</span>) },
            { key: 'status', header: 'Status', cell: (company) => <StatusBadge status={company.active ? 'active' : 'inactive'} /> },
          ]}
        />
      )}
      {editing ? <CompanyForm company={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function CategoryDialog({ category, type, onClose }: { category: CategoryDto | null; type: CategoryType; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [active, setActive] = useState(category?.active ?? true);
  const save = useSave(
    () => (category ? put(`/settings/categories/${category.id}`, { name, active }) : post('/settings/categories', { name, type })),
    onClose,
  );
  return (
    <Modal
      title={category ? 'Edit category' : `Add ${type === 'income' ? 'an income' : 'an expense'} category`}
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
      <Field label="Name" error={save.failure?.fields.name}>
        <Input value={name} autoFocus invalid={!!save.failure?.fields.name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {category && !category.system ? (
        <div>
          <Checkbox label="In use" checked={active} onChange={setActive} />
          <div className="text-xs text-ink-faint">Switched-off categories cannot be chosen on new records. Past records keep them.</div>
        </div>
      ) : null}
      {category?.system ? <div className="text-xs text-ink-faint">The app books {category.system === 'sales' ? 'invoices' : 'salary runs'} to this category, so it cannot be switched off.</div> : null}
      {save.failure && !save.failure.fields.name ? <Notice tone="error">{save.failure.message}</Notice> : null}
    </Modal>
  );
}

function Categories({ type, title }: { type: CategoryType; title: string }) {
  const categories = useGet<CategoryDto[]>('/settings/categories');
  const [editing, setEditing] = useState<CategoryDto | 'new' | null>(null);
  const rows = (categories.data ?? []).filter((category) => category.type === type);
  return (
    <Card
      title={title}
      padded={false}
      right={
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>
          Add
        </Button>
      }
    >
      <Table
        rows={rows}
        rowKey={(category) => category.id}
        onRowClick={setEditing}
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (category) => (
              <span>
                {category.name}
                {category.system ? <span className="text-xs text-ink-ghost"> · used by the app</span> : null}
              </span>
            ),
          },
          { key: 'status', header: 'Status', cell: (category) => <StatusBadge status={category.active ? 'active' : 'inactive'} /> },
        ]}
      />
      {editing ? <CategoryDialog category={editing === 'new' ? null : editing} type={type} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function Approvers() {
  const approval = useGet<ApprovalSettingsDto>('/settings/approval');
  const users = useGet<UserDto[]>('/users');
  const [draft, setDraft] = useState<ApprovalSettingsDto | null>(null);
  const [saved, setSaved] = useState(false);
  const value = draft ?? approval.data;
  const save = useSave(
    () => put('/settings/approval', value),
    () => {
      setDraft(null);
      setSaved(true);
    },
  );
  if (!value || !users.data) return <Card title="Approvers"><Loading /></Card>;

  const candidates = users.data.filter((user) => (user.active && APPROVER_ROLES.includes(user.role)) || value.approverIds.includes(user.id));
  const change = (next: ApprovalSettingsDto) => {
    setSaved(false);
    setDraft(next);
  };
  const fieldError = Object.entries(save.failure?.fields ?? {}).find(([key]) => key.startsWith('approverIds'))?.[1];

  return (
    <Card title="Approvers">
      <div className="space-y-4">
        <p className="text-sm text-ink-dim">
          Quotes, expenses, claims and salary runs must be approved by these people before they can be sent or paid. Nobody can approve their own item, so choose
          at least two if approvers also create items.
        </p>
        <div className="space-y-2">
          {candidates.map((user) => (
            <div key={user.id}>
              <Checkbox
                label={
                  <span>
                    {user.name} <span className="text-ink-faint">· {ROLE_LABELS[user.role]}</span>
                  </span>
                }
                checked={value.approverIds.includes(user.id)}
                onChange={(checked) =>
                  change({
                    ...value,
                    approverIds: checked ? [...value.approverIds, user.id] : value.approverIds.filter((id) => id !== user.id),
                  })
                }
              />
            </div>
          ))}
          {candidates.length === 0 ? <div className="text-sm text-ink-ghost">No admins or bookkeepers yet.</div> : null}
        </div>
        {fieldError ? <div className="text-xs text-breach">{fieldError}</div> : null}
        <Field label="Approvals needed on each item" error={save.failure?.fields.approvalsRequired} className="max-w-xs">
          <Select value={value.approvalsRequired} onChange={(event) => change({ ...value, approvalsRequired: Number(event.target.value) })}>
            {Array.from({ length: Math.max(1, value.approverIds.length, value.approvalsRequired) }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </Field>
        {value.approverIds.length === 0 ? <Notice tone="warning">No approvers are chosen, so nothing can be submitted for approval yet.</Notice> : null}
        {save.failure && !fieldError && !save.failure.fields.approvalsRequired ? <Notice tone="error">{save.failure.message}</Notice> : null}
        <div className="flex items-center gap-3">
          <Button variant="primary" busy={save.busy} disabled={!draft} onClick={() => void save.run()}>
            Save approvers
          </Button>
          {saved ? <span className="text-sm text-authored">Saved.</span> : null}
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  return (
    <Page title="Settings" subtitle="Company details for documents, who approves, and the categories the P&L is grouped by.">
      <Companies />
      <Approvers />
      <div className="grid gap-5 md:grid-cols-2">
        <Categories type="income" title="Income categories" />
        <Categories type="expense" title="Expense categories" />
      </div>
    </Page>
  );
}
