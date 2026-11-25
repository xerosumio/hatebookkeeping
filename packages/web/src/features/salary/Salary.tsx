import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  addMonthsToMonth,
  centsToInput,
  formatMoney,
  hkCurrentMonth,
  monthLabel,
  salaryRunCreateSchema,
  staffInputSchema,
  type ExpenseDto,
  type SalaryRunCreateInput,
  type StaffDto,
  type StaffInput,
} from '@hbk/shared';
import { del, post, put, useGet, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { CompanyField, useCompanies } from '../../shared/company';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, FormGrid, Input, Loading, Modal, MoneyInput, Notice, Page, Table, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';

function StaffDialog({ staff, canManage, onClose }: { staff: StaffDto | null; canManage: boolean; onClose: () => void }) {
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(staff?.company.id ?? defaultId);
  const [name, setName] = useState(staff?.name ?? '');
  const [salary, setSalary] = useState(staff ? centsToInput(staff.monthlySalary) : '');
  const [bankName, setBankName] = useState(staff?.bankName ?? '');
  const [bankAccountNumber, setBankAccountNumber] = useState(staff?.bankAccountNumber ?? '');
  const [fpsId, setFpsId] = useState(staff?.fpsId ?? '');
  const [notes, setNotes] = useState(staff?.notes ?? '');
  const [active, setActive] = useState(staff?.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const build = useCallback(
    () => ({ companyId: companyId || defaultId, name, monthlySalary: centsOf(salary), bankName, bankAccountNumber, fpsId, notes, active }),
    [companyId, defaultId, name, salary, bankName, bankAccountNumber, fpsId, notes, active],
  );
  const send = useCallback((value: StaffInput) => (staff ? put(`/salary/staff/${staff.id}`, value) : post('/salary/staff', value)), [staff]);
  const save = useFormSave(staffInputSchema, build, send, onClose);
  const remove = useSave(() => del(`/salary/staff/${staff!.id}`), onClose);

  return (
    <Modal
      title={staff ? staff.name : 'Add a staff member'}
      onClose={onClose}
      footer={
        canManage ? (
          <>
            {staff ? (
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
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} disabled={!canManage} />
      <FormGrid>
        <Field label="Name" error={save.errors.name}>
          <Input value={name} disabled={!canManage} invalid={!!save.errors.name} autoFocus onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Monthly salary" error={save.errors.monthlySalary} hint="The amount a new salary run starts with.">
          <MoneyInput value={salary} disabled={!canManage} invalid={!!save.errors.monthlySalary} onChange={(event) => setSalary(event.target.value)} />
        </Field>
        <Field label="Bank" error={save.errors.bankName}>
          <Input value={bankName} disabled={!canManage} onChange={(event) => setBankName(event.target.value)} />
        </Field>
        <Field label="Account number" error={save.errors.bankAccountNumber}>
          <Input value={bankAccountNumber} disabled={!canManage} onChange={(event) => setBankAccountNumber(event.target.value)} />
        </Field>
        <Field label="FPS ID" error={save.errors.fpsId}>
          <Input value={fpsId} disabled={!canManage} onChange={(event) => setFpsId(event.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Notes" error={save.errors.notes}>
        <Textarea rows={2} value={notes} disabled={!canManage} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <Checkbox label="On the payroll (included when a salary run is started)" checked={active} disabled={!canManage} onChange={setActive} />
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
      {confirmDelete && staff ? (
        <ConfirmDialog title={`Delete ${staff.name}?`} confirmLabel="Delete" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={() => setConfirmDelete(false)}>
          Someone who has been on a salary run cannot be deleted. Take them off the payroll instead.
        </ConfirmDialog>
      ) : null}
    </Modal>
  );
}

function StartRunDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(defaultId);
  const [month, setMonth] = useState(hkCurrentMonth());
  const build = useCallback(() => ({ companyId: companyId || defaultId, month }), [companyId, defaultId, month]);
  const send = useCallback((value: SalaryRunCreateInput) => post<ExpenseDto>('/salary/runs', value), []);
  const done = useCallback((run: ExpenseDto) => navigate(`/salary/runs/${run.id}`), [navigate]);
  const save = useFormSave(salaryRunCreateSchema, build, send, done);

  return (
    <Modal
      title="Start a salary run"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
            Start
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-dim">
        The run starts with everyone on the payroll at their monthly salary. You can adjust each amount before submitting it for approval.
      </div>
      <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} />
      <Field label="Salary month" error={save.errors.month}>
        <Input type="month" value={month} max={addMonthsToMonth(hkCurrentMonth(), 1)} invalid={!!save.errors.month} onChange={(event) => setMonth(event.target.value)} />
      </Field>
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
    </Modal>
  );
}

export default function Salary() {
  const { can } = useAuth();
  const { selectedId, companies } = useCompanies();
  const navigate = useNavigate();
  const canManage = can('salary.manage');
  const runs = useGet<ExpenseDto[]>('/salary/runs', { companyId: selectedId });
  const staff = useGet<StaffDto[]>('/salary/staff', { companyId: selectedId });
  const [editing, setEditing] = useState<StaffDto | 'new' | null>(null);
  const [starting, setStarting] = useState(false);
  const [showOff, setShowOff] = useState(false);

  const members = (staff.data ?? []).filter((member) => showOff || member.active);
  const payroll = (staff.data ?? []).filter((member) => member.active).reduce((sum, member) => sum + member.monthlySalary, 0);
  const manyCompanies = companies.length > 1;

  return (
    <Page
      title="Salary"
      subtitle="One salary run per month. It is approved and paid like an expense, and counts in the P&L under Salary."
      actions={
        canManage ? (
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setStarting(true)}>
            Start a salary run
          </Button>
        ) : null
      }
    >
      <Card padded={false} title="Salary runs">
        {runs.isPending ? (
          <Loading />
        ) : runs.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the salary runs.</Notice>
          </div>
        ) : (
          <Table
            rows={runs.data}
            rowKey={(run) => run.id}
            onRowClick={(run) => navigate(`/salary/runs/${run.id}`)}
            empty="No salary runs yet. Add your staff below, then start the first run."
            columns={[
              { key: 'month', header: 'Month', cell: (run) => <span className="font-medium">{run.salaryMonth ? monthLabel(run.salaryMonth) : '—'}</span> },
              { key: 'number', header: 'Number', cell: (run) => run.number },
              ...(manyCompanies ? [{ key: 'company', header: 'Company', cell: (run: ExpenseDto) => run.company.name }] : []),
              { key: 'staff', header: 'Staff', align: 'right', cell: (run) => run.items.length },
              { key: 'total', header: 'Total', align: 'right', cell: (run) => formatMoney(run.total) },
              { key: 'status', header: 'Status', cell: (run) => <StatusBadge status={run.status} /> },
            ]}
          />
        )}
      </Card>

      <Card
        padded={false}
        title={
          <span>
            Staff <span className="font-normal text-ink-faint">· {formatMoney(payroll)} a month</span>
          </span>
        }
        right={
          <>
            <Checkbox label="Show people off the payroll" checked={showOff} onChange={setShowOff} />
            {canManage ? (
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>
                Add staff
              </Button>
            ) : null}
          </>
        }
      >
        {staff.isPending ? (
          <Loading />
        ) : staff.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the staff list.</Notice>
          </div>
        ) : (
          <Table
            rows={members}
            rowKey={(member) => member.id}
            onRowClick={setEditing}
            empty="No staff yet."
            columns={[
              { key: 'name', header: 'Name', cell: (member) => <span className="font-medium">{member.name}</span> },
              ...(manyCompanies ? [{ key: 'company', header: 'Company', cell: (member: StaffDto) => member.company.name }] : []),
              { key: 'paid', header: 'Paid to', cell: (member) => [member.bankName, member.bankAccountNumber].filter(Boolean).join(' ') || member.fpsId || '—' },
              { key: 'salary', header: 'Monthly salary', align: 'right', cell: (member) => formatMoney(member.monthlySalary) },
              { key: 'status', header: '', cell: (member) => (member.active ? null : <StatusBadge status="inactive" />) },
            ]}
          />
        )}
      </Card>

      {editing ? <StaffDialog staff={editing === 'new' ? null : editing} canManage={canManage} onClose={() => setEditing(null)} /> : null}
      {starting ? <StartRunDialog onClose={() => setStarting(false)} /> : null}
    </Page>
  );
}
