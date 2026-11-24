import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { centsToInput, formatMoney, monthLabel, parseMoney, salaryRunUpdateSchema, type ExpenseDto, type SalaryRunUpdateInput, type StaffDto } from '@hbk/shared';
import { put, useGet } from '../../shared/api/hooks';
import { useCompanies } from '../../shared/company';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, DetailRow, Field, Input, Loading, MoneyInput, Notice, Page, Select, Table, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';
import { BackLink, FlowActions, FlowNotices, FlowSide } from '../expenses/flow';

interface LineDraft {
  staffId: string;
  name: string;
  amount: string;
  note: string;
}

function Editor({ run, onClose }: { run: ExpenseDto; onClose: () => void }) {
  const staff = useGet<StaffDto[]>('/salary/staff', { companyId: run.company.id });
  const [lines, setLines] = useState<LineDraft[]>(
    run.items.map((item) => ({ staffId: item.staffId ?? '', name: item.description, amount: centsToInput(item.amount), note: item.note })),
  );
  const [notes, setNotes] = useState(run.notes);
  const [adding, setAdding] = useState('');

  const build = useCallback(
    () => ({ lines: lines.map((line) => ({ staffId: line.staffId, amount: centsOf(line.amount), note: line.note })), notes }),
    [lines, notes],
  );
  const send = useCallback((value: SalaryRunUpdateInput) => put<ExpenseDto>(`/salary/runs/${run.id}`, value), [run.id]);
  const save = useFormSave(salaryRunUpdateSchema, build, send, onClose);

  const update = (index: number, patch: Partial<LineDraft>) => setLines(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  const lineError = (index: number) => save.errors[`lines.${index}.amount`] ?? save.errors[`lines.${index}.staffId`] ?? save.errors[`lines.${index}.note`];
  const total = lines.reduce((sum, line) => sum + (parseMoney(line.amount) ?? 0), 0);
  // People on the payroll who are not on this run yet.
  const addable = (staff.data ?? []).filter((member) => member.active && !lines.some((line) => line.staffId === member.id));

  return (
    <Card title="Adjust the run">
      <div className="space-y-3">
        {run.status !== 'draft' ? <Notice tone="warning">This has already been submitted. Saving a change clears its approvals and sends it for approval again.</Notice> : null}
        <div className="hidden grid-cols-[1fr_170px_1fr_36px] gap-2 text-xs font-medium text-ink-faint md:grid">
          <span>Staff member</span>
          <span className="text-right">Amount this month</span>
          <span>Note</span>
          <span />
        </div>
        {lines.map((line, index) => (
          <div key={line.staffId}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_170px_1fr_36px] md:items-center">
              <div className="col-span-2 text-sm font-medium text-ink md:col-span-1">{line.name}</div>
              <MoneyInput aria-label={`Amount for ${line.name}`} value={line.amount} invalid={!!save.errors[`lines.${index}.amount`]} onChange={(event) => update(index, { amount: event.target.value })} />
              <Input aria-label={`Note for ${line.name}`} placeholder="e.g. includes bonus" value={line.note} onChange={(event) => update(index, { note: event.target.value })} />
              <button
                type="button"
                aria-label={`Leave ${line.name} off this run`}
                title="Leave off this run"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, at) => at !== index))}
                className="justify-self-end rounded p-1.5 text-ink-ghost hover:bg-raised disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {lineError(index) ? <div className="mt-1 text-xs text-breach">{lineError(index)}</div> : null}
          </div>
        ))}
        {save.errors.lines ? <div className="text-xs text-breach">{save.errors.lines}</div> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-3">
          {addable.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select aria-label="Add a staff member" className="!w-auto" value={adding} onChange={(event) => setAdding(event.target.value)}>
                <option value="">Add someone…</option>
                {addable.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={!adding}
                onClick={() => {
                  const member = addable.find((candidate) => candidate.id === adding);
                  if (member) setLines([...lines, { staffId: member.id, name: member.name, amount: centsToInput(member.monthlySalary), note: '' }]);
                  setAdding('');
                }}
              >
                Add
              </Button>
            </div>
          ) : (
            <span />
          )}
          <div className="text-sm">
            <span className="text-ink-faint">Total </span>
            <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        <Field label="Notes" error={save.errors.notes}>
          <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {save.message ? <Notice tone="error">{save.message}</Notice> : null}
        <div className="flex gap-2">
          <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
            Save changes
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

export default function SalaryRun() {
  const { id } = useParams();
  const query = useGet<ExpenseDto>(`/salary/runs/${id}`);
  const { all } = useCompanies();
  const [editing, setEditing] = useState(false);

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Salary run" back={<BackLink to="/salary">Salary</BackLink>}>
        <Notice tone="error">That salary run could not be loaded.</Notice>
      </Page>
    );
  }
  const run = query.data;
  const canEdit = run.actions.includes('edit');

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {run.title}
          <StatusBadge status={run.status} />
        </span>
      }
      subtitle={run.number}
      back={<BackLink to="/salary">Salary</BackLink>}
      actions={editing ? null : <FlowActions base="/salary/runs" expense={run} extra={canEdit ? <Button onClick={() => setEditing(true)}>Adjust</Button> : null} />}
    >
      <FlowNotices expense={run} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {editing && canEdit ? (
            <Editor key={run.id} run={run} onClose={() => setEditing(false)} />
          ) : (
            <Card padded={false} title="Salaries">
              <Table
                rows={run.items.map((item, index) => ({ ...item, index }))}
                rowKey={(item) => String(item.index)}
                columns={[
                  { key: 'name', header: 'Staff member', cell: (item) => <span className="font-medium">{item.description}</span> },
                  { key: 'note', header: 'Note', cell: (item) => item.note || '—' },
                  { key: 'amount', header: 'Amount', align: 'right', cell: (item) => formatMoney(item.amount) },
                ]}
                footer={
                  <tr className="border-t border-hair">
                    <td colSpan={2} className="px-4 py-2.5 text-right text-sm text-ink-faint">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(run.total)}</td>
                  </tr>
                }
              />
            </Card>
          )}
          {run.notes && !editing ? (
            <Card title="Notes">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{run.notes}</div>
            </Card>
          ) : null}
        </div>
        <div className="space-y-5">
          <Card title="Summary">
            <DetailRow label="Total">
              <span className="font-semibold">{formatMoney(run.total)}</span>
            </DetailRow>
            <DetailRow label="Salary month">{run.salaryMonth ? monthLabel(run.salaryMonth) : '—'}</DetailRow>
            <DetailRow label="Staff">{run.items.length}</DetailRow>
            {all.length > 1 ? <DetailRow label="Company">{run.company.name}</DetailRow> : null}
            <DetailRow label="Prepared by">{run.createdBy.name}</DetailRow>
          </Card>
          <FlowSide expense={run} />
        </div>
      </div>
    </Page>
  );
}
