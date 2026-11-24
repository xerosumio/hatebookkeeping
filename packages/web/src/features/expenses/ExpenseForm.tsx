import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { centsToInput, expenseInputSchema, formatMoney, hkToday, parseMoney, type ExpenseDto, type ExpenseInput } from '@hbk/shared';
import { post, put, useGet } from '../../shared/api/hooks';
import { CompanyField, useCompanies } from '../../shared/company';
import { FileLink, UploadButton } from '../../shared/components/files';
import { CategorySelect, PayeePicker } from '../../shared/components/pickers';
import { Button, Card, Field, FormGrid, Input, Loading, MoneyInput, Notice, Page, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';

interface ItemDraft {
  description: string;
  categoryId: string;
  amount: string;
}
const emptyItem = (categoryId = ''): ItemDraft => ({ description: '', categoryId, amount: '' });

function Form({ expense }: { expense: ExpenseDto | null }) {
  const navigate = useNavigate();
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(expense?.company.id ?? defaultId);
  const [payeeId, setPayeeId] = useState(expense?.payee?.id ?? '');
  const [title, setTitle] = useState(expense?.title ?? '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? hkToday());
  const [dueDate, setDueDate] = useState(expense?.dueDate ?? '');
  const [items, setItems] = useState<ItemDraft[]>(
    expense ? expense.items.map((item) => ({ description: item.description, categoryId: item.categoryId, amount: centsToInput(item.amount) })) : [emptyItem()],
  );
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(expense?.attachmentIds ?? []);

  const build = useCallback(
    () => ({
      companyId: companyId || defaultId,
      title,
      payeeId,
      expenseDate,
      dueDate,
      items: items.map((item) => ({ description: item.description, categoryId: item.categoryId, amount: centsOf(item.amount) })),
      notes,
      attachmentIds,
    }),
    [companyId, defaultId, title, payeeId, expenseDate, dueDate, items, notes, attachmentIds],
  );
  const send = useCallback((value: ExpenseInput) => (expense ? put<ExpenseDto>(`/expenses/${expense.id}`, value) : post<ExpenseDto>('/expenses', value)), [expense]);
  const done = useCallback((saved: ExpenseDto) => navigate(`/expenses/${saved.id}`), [navigate]);
  const save = useFormSave(expenseInputSchema, build, send, done);

  const update = (index: number, patch: Partial<ItemDraft>) => setItems(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  const itemError = (index: number) =>
    save.errors[`items.${index}.description`] ?? save.errors[`items.${index}.categoryId`] ?? save.errors[`items.${index}.amount`];
  const total = items.reduce((sum, item) => sum + (parseMoney(item.amount) ?? 0), 0);
  const resubmits = expense !== null && expense.status !== 'draft';
  const backTo = expense ? `/expenses/${expense.id}` : '/expenses';

  return (
    <Page title={expense ? `Edit ${expense.number}` : 'New expense'} back={<Link to={backTo} className="text-human">← Back</Link>}>
      {resubmits ? <Notice tone="warning">This has already been submitted. Saving a change clears its approvals and sends it for approval again.</Notice> : null}
      <Card title="Details">
        <FormGrid>
          <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} />
          <PayeePicker value={payeeId} onChange={setPayeeId} error={save.errors.payeeId} />
          <Field label="Title" error={save.errors.title} hint="What it is for, e.g. “Office rent, May”.">
            <Input value={title} invalid={!!save.errors.title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expense date" error={save.errors.expenseDate} hint="The date on the bill.">
              <Input type="date" value={expenseDate} invalid={!!save.errors.expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
            </Field>
            <Field label="Due date" error={save.errors.dueDate}>
              <Input type="date" value={dueDate} invalid={!!save.errors.dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
          </div>
        </FormGrid>
      </Card>

      <Card title="Lines">
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_220px_160px_36px] gap-2 text-xs font-medium text-ink-faint md:grid">
            <span>Description</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {items.map((item, index) => (
            <div key={index}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_220px_160px_36px] md:items-center">
                <Input
                  className="col-span-2 md:col-span-1"
                  aria-label={`Line ${index + 1} description`}
                  placeholder="Description"
                  value={item.description}
                  invalid={!!save.errors[`items.${index}.description`]}
                  onChange={(event) => update(index, { description: event.target.value })}
                />
                <CategorySelect
                  type="expense"
                  ariaLabel={`Line ${index + 1} category`}
                  value={item.categoryId}
                  invalid={!!save.errors[`items.${index}.categoryId`]}
                  onChange={(categoryId) => update(index, { categoryId })}
                />
                <MoneyInput
                  aria-label={`Line ${index + 1} amount`}
                  value={item.amount}
                  invalid={!!save.errors[`items.${index}.amount`]}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, at) => at !== index))}
                  className="justify-self-end rounded p-1.5 text-ink-ghost hover:bg-raised disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {itemError(index) ? <div className="mt-1 text-xs text-breach">{itemError(index)}</div> : null}
            </div>
          ))}
          {save.errors.items ? <div className="text-xs text-breach">{save.errors.items}</div> : null}
          <div className="flex items-center justify-between border-t border-hair pt-3">
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setItems([...items, emptyItem(items[items.length - 1]?.categoryId)])}>
              Add line
            </Button>
            <div className="text-sm">
              <span className="text-ink-faint">Total </span>
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Notes and attachments">
        <div className="space-y-4">
          <Field label="Notes" error={save.errors.notes}>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-dim">Attachments</div>
            <div className="flex flex-wrap items-center gap-2">
              {attachmentIds.map((fileId, index) => (
                <span key={fileId} className="inline-flex items-center rounded border border-hair">
                  <FileLink fileId={fileId} label={`Attachment ${index + 1}`} />
                  <button
                    type="button"
                    aria-label={`Remove attachment ${index + 1}`}
                    className="p-1.5 text-ink-ghost hover:bg-raised"
                    onClick={() => setAttachmentIds(attachmentIds.filter((id) => id !== fileId))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <UploadButton purpose="receipt" label="Attach the bill" onUploaded={(file) => setAttachmentIds((ids) => [...ids, file.id])} />
            </div>
            {save.errors.attachmentIds ? <div className="mt-1 text-xs text-breach">{save.errors.attachmentIds}</div> : null}
            <div className="mt-1 text-xs text-ink-faint">An image or PDF, up to 5 MB each.</div>
          </div>
        </div>
      </Card>

      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
          {expense ? 'Save changes' : 'Save as draft'}
        </Button>
        <Link to={backTo}>
          <Button>Cancel</Button>
        </Link>
      </div>
    </Page>
  );
}

export default function ExpenseForm() {
  const { id } = useParams();
  const expense = useGet<ExpenseDto>(id ? `/expenses/${id}` : null);
  const { loaded } = useCompanies();
  if (!loaded || (id && expense.isPending)) return <Loading />;
  if (id && !expense.data) {
    return (
      <Page title="Expense">
        <Notice tone="error">That expense could not be loaded.</Notice>
      </Page>
    );
  }
  return <Form key={id ?? 'new'} expense={expense.data ?? null} />;
}
