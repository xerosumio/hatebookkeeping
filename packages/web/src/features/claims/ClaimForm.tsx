import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { centsToInput, claimInputSchema, formatMoney, hkToday, parseMoney, type ClaimInput, type ExpenseDto } from '@hbk/shared';
import { post, put, useGet } from '../../shared/api/hooks';
import { CompanyField, useCompanies } from '../../shared/company';
import { FileLink, UploadButton } from '../../shared/components/files';
import { CategorySelect } from '../../shared/components/pickers';
import { Button, Card, Field, FormGrid, Input, Loading, MoneyInput, Notice, Page, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';

interface ItemDraft {
  date: string;
  description: string;
  categoryId: string;
  amount: string;
  receiptFileId: string | null;
}
const emptyItem = (): ItemDraft => ({ date: hkToday(), description: '', categoryId: '', amount: '', receiptFileId: null });

function Form({ claim }: { claim: ExpenseDto | null }) {
  const navigate = useNavigate();
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(claim?.company.id ?? defaultId);
  const [title, setTitle] = useState(claim?.title ?? '');
  const [items, setItems] = useState<ItemDraft[]>(
    claim
      ? claim.items.map((item) => ({
          date: item.date,
          description: item.description,
          categoryId: item.categoryId,
          amount: centsToInput(item.amount),
          receiptFileId: item.receiptFileId,
        }))
      : [emptyItem()],
  );
  const [notes, setNotes] = useState(claim?.notes ?? '');

  const build = useCallback(
    () => ({
      companyId: companyId || defaultId,
      title,
      items: items.map((item) => ({ ...item, amount: centsOf(item.amount) })),
      notes,
    }),
    [companyId, defaultId, title, items, notes],
  );
  const send = useCallback((value: ClaimInput) => (claim ? put<ExpenseDto>(`/claims/${claim.id}`, value) : post<ExpenseDto>('/claims', value)), [claim]);
  const done = useCallback((saved: ExpenseDto) => navigate(`/claims/${saved.id}`), [navigate]);
  const save = useFormSave(claimInputSchema, build, send, done);

  const update = (index: number, patch: Partial<ItemDraft>) => setItems((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  const itemError = (index: number) =>
    (['date', 'description', 'categoryId', 'amount', 'receiptFileId'] as const).map((key) => save.errors[`items.${index}.${key}`]).find(Boolean);
  const total = items.reduce((sum, item) => sum + (parseMoney(item.amount) ?? 0), 0);
  const resubmits = claim !== null && claim.status !== 'draft';
  const backTo = claim ? `/claims/${claim.id}` : '/claims';

  return (
    <Page title={claim ? `Edit ${claim.number}` : 'New claim'} back={<Link to={backTo} className="text-human">← Back</Link>}>
      {resubmits ? <Notice tone="warning">This has already been submitted. Saving a change clears its approvals and sends it for approval again.</Notice> : null}
      <Card title="Details">
        <FormGrid>
          <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} />
          <Field label="Title" error={save.errors.title} hint="What the claim is for, e.g. “Client lunch” or “May travel”.">
            <Input value={title} invalid={!!save.errors.title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        </FormGrid>
      </Card>

      <Card title="Receipts">
        <div className="space-y-4">
          <div className="text-xs text-ink-faint">One line per receipt. Every line needs its receipt attached before the claim can be submitted.</div>
          {items.map((item, index) => (
            <div key={index} className="rounded-md border border-hair p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-[150px_1fr_200px_150px_36px] md:items-center">
                <Input
                  type="date"
                  aria-label={`Line ${index + 1} date on the receipt`}
                  max={hkToday()}
                  value={item.date}
                  invalid={!!save.errors[`items.${index}.date`]}
                  onChange={(event) => update(index, { date: event.target.value })}
                />
                <Input
                  aria-label={`Line ${index + 1} description`}
                  placeholder="What it was for"
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.receiptFileId ? (
                  <>
                    <FileLink fileId={item.receiptFileId} label="View receipt" />
                    <Button size="sm" variant="ghost" onClick={() => update(index, { receiptFileId: null })}>
                      Remove receipt
                    </Button>
                  </>
                ) : (
                  <UploadButton purpose="receipt" label="Attach receipt" onUploaded={(file) => update(index, { receiptFileId: file.id })} />
                )}
              </div>
              {itemError(index) ? <div className="mt-1 text-xs text-breach">{itemError(index)}</div> : null}
            </div>
          ))}
          {save.errors.items ? <div className="text-xs text-breach">{save.errors.items}</div> : null}
          <div className="flex items-center justify-between border-t border-hair pt-3">
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setItems([...items, emptyItem()])}>
              Add receipt
            </Button>
            <div className="text-sm">
              <span className="text-ink-faint">Total </span>
              <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Notes">
        <Field error={save.errors.notes}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </Card>

      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
          {claim ? 'Save changes' : 'Save as draft'}
        </Button>
        <Link to={backTo}>
          <Button>Cancel</Button>
        </Link>
      </div>
    </Page>
  );
}

export default function ClaimForm() {
  const { id } = useParams();
  const claim = useGet<ExpenseDto>(id ? `/claims/${id}` : null);
  const { loaded } = useCompanies();
  if (!loaded || (id && claim.isPending)) return <Loading />;
  if (id && !claim.data) {
    return (
      <Page title="Claim">
        <Notice tone="error">That claim could not be loaded.</Notice>
      </Page>
    );
  }
  return <Form key={id ?? 'new'} claim={claim.data ?? null} />;
}
