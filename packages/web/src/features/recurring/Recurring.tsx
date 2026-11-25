import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  centsToInput,
  formatDate,
  formatDateTime,
  formatMoney,
  hkToday,
  recurringInputSchema,
  type Frequency,
  type GenerateResultDto,
  type RecurringDto,
  type RecurringInput,
  type RecurringKind,
} from '@hbk/shared';
import { del, post, put, useGet, useSave } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { CompanyField, useCompanies } from '../../shared/company';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { CategorySelect, ClientPicker, PayeePicker } from '../../shared/components/pickers';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Field, FormGrid, Input, Loading, Modal, MoneyInput, Notice, Page, Select } from '../../shared/components/ui';
import { centsOf, numberOf, useFormSave } from '../../shared/form';

const documentPath = (kind: RecurringKind, id: string) => `${kind === 'invoice' ? '/invoices' : '/expenses'}/${id}`;
const KIND_WORD: Record<RecurringKind, string> = { invoice: 'invoice', expense: 'expense' };

function ItemDialog({ item, onClose }: { item: RecurringDto | null; onClose: () => void }) {
  const { defaultId } = useCompanies();
  const [kind, setKind] = useState<RecurringKind>(item?.kind ?? 'invoice');
  const [name, setName] = useState(item?.name ?? '');
  const [companyId, setCompanyId] = useState(item?.company.id ?? defaultId);
  const [clientId, setClientId] = useState(item?.client?.id ?? '');
  const [payeeId, setPayeeId] = useState(item?.payee?.id ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [amount, setAmount] = useState(item ? centsToInput(item.amount) : '');
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(item?.startDate ?? hkToday());
  const [endDate, setEndDate] = useState(item?.endDate ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(String(item?.dayOfMonth ?? 1));
  const [remindDaysBefore, setRemindDaysBefore] = useState(String(item?.remindDaysBefore ?? 7));
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(item?.paymentTermsDays ?? 14));
  const [active, setActive] = useState(item?.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const build = useCallback(
    () => ({
      kind,
      name,
      companyId: companyId || defaultId,
      clientId: kind === 'invoice' ? clientId : null,
      payeeId: kind === 'expense' ? payeeId : null,
      categoryId: kind === 'expense' ? categoryId : null,
      description,
      amount: centsOf(amount),
      frequency,
      startDate,
      endDate,
      dayOfMonth: numberOf(dayOfMonth),
      remindDaysBefore: numberOf(remindDaysBefore),
      paymentTermsDays: numberOf(paymentTermsDays),
      active,
    }),
    [kind, name, companyId, defaultId, clientId, payeeId, categoryId, description, amount, frequency, startDate, endDate, dayOfMonth, remindDaysBefore, paymentTermsDays, active],
  );
  const send = useCallback((value: RecurringInput) => (item ? put(`/recurring/${item.id}`, value) : post('/recurring', value)), [item]);
  const save = useFormSave(recurringInputSchema, build, send, onClose);
  const remove = useSave(() => del(`/recurring/${item!.id}`), onClose);

  return (
    <Modal
      wide
      title={item ? item.name : 'Add a recurring item'}
      onClose={onClose}
      footer={
        <>
          {item ? (
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
      <FormGrid>
        <Field label="What recurs" error={save.errors.kind}>
          <Select value={kind} disabled={item !== null} onChange={(event) => setKind(event.target.value as RecurringKind)}>
            <option value="invoice">An invoice to a client</option>
            <option value="expense">A bill to pay</option>
          </Select>
        </Field>
        <Field label="Name" error={save.errors.name} hint="e.g. “Acme retainer” or “Office rent”. Used as the title of each draft.">
          <Input value={name} invalid={!!save.errors.name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} />
        {kind === 'invoice' ? (
          <ClientPicker value={clientId} onChange={setClientId} error={save.errors.clientId} />
        ) : (
          <>
            <PayeePicker value={payeeId} onChange={setPayeeId} error={save.errors.payeeId} />
            <Field label="Category" error={save.errors.categoryId}>
              <CategorySelect type="expense" value={categoryId} invalid={!!save.errors.categoryId} onChange={setCategoryId} />
            </Field>
          </>
        )}
        <Field label="Amount" error={save.errors.amount}>
          <MoneyInput value={amount} invalid={!!save.errors.amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Line description" error={save.errors.description} hint="Optional. The name is used when this is empty.">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </FormGrid>

      <FormGrid columns={3}>
        <Field label="How often" error={save.errors.frequency}>
          <Select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
            {FREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {FREQUENCY_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Day of the month" error={save.errors.dayOfMonth} hint="1 to 28">
          <Input inputMode="numeric" value={dayOfMonth} invalid={!!save.errors.dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
        </Field>
        <Field label="Remind this many days before" error={save.errors.remindDaysBefore}>
          <Input inputMode="numeric" value={remindDaysBefore} invalid={!!save.errors.remindDaysBefore} onChange={(event) => setRemindDaysBefore(event.target.value)} />
        </Field>
        <Field label="Starts" error={save.errors.startDate}>
          <Input type="date" value={startDate} invalid={!!save.errors.startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Ends" error={save.errors.endDate} hint="Leave empty to keep going.">
          <Input type="date" value={endDate} invalid={!!save.errors.endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
        {kind === 'invoice' ? (
          <Field label="Days the client has to pay" error={save.errors.paymentTermsDays}>
            <Input inputMode="numeric" value={paymentTermsDays} invalid={!!save.errors.paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} />
          </Field>
        ) : null}
      </FormGrid>
      <Checkbox label="Active (untick to pause reminders and generating)" checked={active} onChange={setActive} />
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
      {confirmDelete && item ? (
        <ConfirmDialog title={`Delete ${item.name}?`} confirmLabel="Delete" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={() => setConfirmDelete(false)}>
          The schedule is removed. Invoices and expenses it already produced stay where they are.
        </ConfirmDialog>
      ) : null}
    </Modal>
  );
}

function ItemCard({ item, canManage, onEdit }: { item: RecurringDto; canManage: boolean; onEdit: () => void }) {
  const generate = useSave((period: string) => post(`/recurring/${item.id}/generate`, { period }));
  const skip = useSave((period: string) => post(`/recurring/${item.id}/skip`, { period }));
  const [skipping, setSkipping] = useState<string | null>(null);
  const today = hkToday();
  const counterparty = item.kind === 'invoice' ? item.client?.name : item.payee?.name;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {item.name}
          <StatusBadge status={item.state} />
        </span>
      }
      right={canManage ? <Button size="sm" onClick={onEdit}>Edit</Button> : null}
    >
      <div className="space-y-3 text-sm">
        <div className="text-ink-dim">
          {item.kind === 'invoice' ? 'Invoice to' : 'Bill from'} <span className="text-ink">{counterparty}</span> · {formatMoney(item.amount)} ·{' '}
          {FREQUENCY_LABELS[item.frequency].toLowerCase()} on day {item.dayOfMonth}
          {item.kind === 'expense' && item.categoryName ? ` · ${item.categoryName}` : ''}
          {item.endDate ? ` · until ${formatDate(item.endDate)}` : ''}
        </div>

        {item.pending.map((period) => (
          <div key={period} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-signal-dim/50 bg-signal-wash px-3 py-2">
            <span className={period < today ? 'text-breach' : 'text-signal'}>
              {period < today ? 'Was due' : period === today ? 'Due today:' : 'Due'} {formatDate(period)}
            </span>
            {canManage ? (
              <span className="flex gap-2">
                <Button size="sm" busy={skip.busy} onClick={() => setSkipping(period)}>
                  Skip
                </Button>
                <Button size="sm" variant="primary" busy={generate.busy} onClick={() => void generate.run(period)}>
                  Create draft {KIND_WORD[item.kind]}
                </Button>
              </span>
            ) : null}
          </div>
        ))}
        {generate.failure ? <Notice tone="error">{generate.failure.message}</Notice> : null}

        <div className="text-xs text-ink-faint">
          {item.state === 'paused' ? 'Paused.' : item.nextDue ? `Next: ${formatDate(item.nextDue)}.` : item.pending.length === 0 ? 'No more periods to come.' : ''}{' '}
          {item.lastReminder ? (
            <span className={item.lastReminder.status === 'sent' ? '' : 'text-breach'}>
              Reminder for {formatDate(item.lastReminder.period)}:{' '}
              {item.lastReminder.status === 'sent' ? `sent ${formatDateTime(item.lastReminder.at)}` : item.lastReminder.detail}
            </span>
          ) : null}
        </div>

        {item.history.length > 0 ? (
          <div className="border-t border-hair pt-2 text-xs text-ink-dim">
            {item.history.slice(0, 4).map((entry) => (
              <div key={entry.period} className="flex justify-between gap-3 py-0.5">
                <span>
                  {formatDate(entry.period)} ·{' '}
                  {entry.action === 'skipped' ? (
                    'skipped'
                  ) : entry.document ? (
                    <Link to={documentPath(entry.document.kind, entry.document.id)} className="text-human underline">
                      {entry.document.number || `draft ${KIND_WORD[entry.document.kind]}`}
                    </Link>
                  ) : (
                    'created, then deleted'
                  )}
                </span>
                <span className="text-ink-ghost">{entry.userName}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {skipping ? (
        <ConfirmDialog
          title={`Skip ${formatDate(skipping)}?`}
          confirmLabel="Skip this period"
          busy={skip.busy}
          failure={skip.failure}
          onConfirm={() => void skip.run(skipping).then((done) => done !== undefined && setSkipping(null))}
          onClose={() => setSkipping(null)}
        >
          Nothing is created for this period, and “{item.name}” moves on to the next one.
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}

export default function Recurring() {
  const { can } = useAuth();
  const { selectedId } = useCompanies();
  const canManage = can('recurring.manage');
  const items = useGet<RecurringDto[]>('/recurring', { companyId: selectedId });
  const [editing, setEditing] = useState<RecurringDto | 'new' | null>(null);
  const [results, setResults] = useState<GenerateResultDto[] | null>(null);
  const generateAll = useSave(
    () => post<GenerateResultDto[]>(`/recurring/generate-due${selectedId ? `?companyId=${selectedId}` : ''}`),
    (done) => setResults(done),
  );
  const waiting = (items.data ?? []).reduce((count, item) => count + item.pending.length, 0);

  return (
    <Page
      title="Recurring"
      subtitle="Invoices and bills that come round on a schedule. You are reminded by email; each draft is created here and then issued or approved as usual."
      actions={
        canManage ? (
          <>
            {waiting > 1 ? (
              <Button busy={generateAll.busy} onClick={() => void generateAll.run()}>
                Create all {waiting} drafts
              </Button>
            ) : null}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              Add recurring item
            </Button>
          </>
        ) : null
      }
    >
      {generateAll.failure ? <Notice tone="error">{generateAll.failure.message}</Notice> : null}
      {results ? (
        <Card title="What was created" right={<Button size="sm" onClick={() => setResults(null)}>Dismiss</Button>}>
          {results.length === 0 ? (
            <div className="text-sm text-ink-dim">Nothing was due.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {results.map((result) => (
                <li key={`${result.itemId}-${result.period}`} className={result.ok ? 'text-ink' : 'text-breach'}>
                  <span className="font-medium">{result.name}</span> · {formatDate(result.period)} ·{' '}
                  {result.ok && result.document ? (
                    <Link to={documentPath(result.document.kind, result.document.id)} className="text-human underline">
                      {result.message}
                    </Link>
                  ) : (
                    `Not created: ${result.message}`
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {items.isPending ? (
        <Loading />
      ) : items.isError ? (
        <Notice tone="error">Could not load the recurring items.</Notice>
      ) : items.data.length === 0 ? (
        <Card>
          <div className="py-6 text-center text-sm text-ink-ghost">Nothing recurring yet. Add a retainer you invoice every month, or a bill such as rent.</div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {items.data.map((item) => (
            <ItemCard key={item.id} item={item} canManage={canManage} onEdit={() => setEditing(item)} />
          ))}
        </div>
      )}
      {editing ? <ItemDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Page>
  );
}
