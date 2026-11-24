import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { formatMoney, hkToday, milestoneAmounts, quoteInputSchema, type QuoteDto, type QuoteInput } from '@hbk/shared';
import { post, put, useGet } from '../../shared/api/hooks';
import { CompanyField, useCompanies } from '../../shared/company';
import { LineItemsEditor } from '../../shared/components/LineItems';
import { ClientPicker } from '../../shared/components/pickers';
import { Button, Card, Field, FormGrid, Input, Loading, Notice, Page, Textarea } from '../../shared/components/ui';
import { numberOf, useFormSave } from '../../shared/form';
import { discountFromDto, discountPayload, emptyLine, linesFromDto, linesPayload, previewTotals, type DiscountDraft, type LineDraft } from '../../shared/lines';

interface MilestoneDraft {
  label: string;
  percentage: string;
  dueDescription: string;
}

function Form({ quote }: { quote: QuoteDto | null }) {
  const navigate = useNavigate();
  const { defaultId, companies } = useCompanies();
  const [companyId, setCompanyId] = useState(quote?.company.id ?? defaultId);
  const [clientId, setClientId] = useState(quote?.client.id ?? '');
  const [title, setTitle] = useState(quote?.title ?? '');
  const [issueDate, setIssueDate] = useState(quote?.issueDate ?? hkToday());
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? '');
  const [lines, setLines] = useState<LineDraft[]>(quote ? linesFromDto(quote.lineItems) : [emptyLine()]);
  const [discount, setDiscount] = useState<DiscountDraft>(quote ? discountFromDto(quote.discountType, quote.discountValue) : { type: 'none', value: '' });
  const [schedule, setSchedule] = useState<MilestoneDraft[]>(
    quote?.paymentSchedule.map((milestone) => ({ label: milestone.label, percentage: String(milestone.percentage), dueDescription: milestone.dueDescription })) ?? [],
  );
  const company = companies.find((candidate) => candidate.id === (companyId || defaultId));
  // A new quote starts with the company's standard terms; they can be changed per quote.
  const [terms, setTerms] = useState<string | null>(quote?.terms ?? null);
  const [notes, setNotes] = useState(quote?.notes ?? '');
  const shownTerms = terms ?? company?.quoteTerms ?? '';

  const build = useCallback(
    () => ({
      companyId: companyId || defaultId,
      clientId,
      title,
      issueDate,
      validUntil,
      lineItems: linesPayload(lines),
      ...discountPayload(discount),
      paymentSchedule: schedule.map((milestone) => ({ ...milestone, percentage: numberOf(milestone.percentage) })),
      terms: shownTerms,
      notes,
    }),
    [companyId, defaultId, clientId, title, issueDate, validUntil, lines, discount, schedule, shownTerms, notes],
  );
  const send = useCallback((value: QuoteInput) => (quote ? put<QuoteDto>(`/quotes/${quote.id}`, value) : post<QuoteDto>('/quotes', value)), [quote]);
  const done = useCallback((saved: QuoteDto) => navigate(`/quotes/${saved.id}`), [navigate]);
  const save = useFormSave(quoteInputSchema, build, send, done);

  const total = previewTotals(lines, discount).total;
  const percentages = schedule.map((milestone) => Number(milestone.percentage) || 0);
  const amounts = milestoneAmounts(total, percentages);
  const percentTotal = percentages.reduce((sum, value) => sum + value, 0);
  const setMilestone = (index: number, patch: Partial<MilestoneDraft>) => setSchedule(schedule.map((milestone, at) => (at === index ? { ...milestone, ...patch } : milestone)));

  return (
    <Page title={quote ? `Edit ${quote.number}` : 'New quote'} back={<Link to={quote ? `/quotes/${quote.id}` : '/quotes'} className="text-human">← Back</Link>}>
      <Card title="Details">
        <FormGrid>
          <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} disabled={quote !== null} />
          <ClientPicker value={clientId} onChange={setClientId} error={save.errors.clientId} />
          <Field label="Title" error={save.errors.title} hint="What the quote is for.">
            <Input value={title} invalid={!!save.errors.title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quote date" error={save.errors.issueDate}>
              <Input type="date" value={issueDate} invalid={!!save.errors.issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            </Field>
            <Field label="Valid until" error={save.errors.validUntil}>
              <Input type="date" value={validUntil} invalid={!!save.errors.validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </Field>
          </div>
        </FormGrid>
      </Card>

      <Card title="Lines">
        <LineItemsEditor lines={lines} onChange={setLines} discount={discount} onDiscountChange={setDiscount} errors={save.errors} allowWaive />
      </Card>

      <Card
        title="Payment schedule"
        right={
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setSchedule([...schedule, { label: '', percentage: '', dueDescription: '' }])}>
            Add milestone
          </Button>
        }
      >
        {schedule.length === 0 ? (
          <div className="text-sm text-ink-faint">No milestones: the quote is invoiced in one go. Add milestones to invoice it in parts, such as a deposit and a final payment.</div>
        ) : (
          <div className="space-y-2">
            {schedule.map((milestone, index) => (
              <div key={index}>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_90px_1fr_120px_36px] md:items-center">
                  <Input
                    aria-label={`Milestone ${index + 1} name`}
                    placeholder="Name, e.g. Deposit"
                    value={milestone.label}
                    invalid={!!save.errors[`paymentSchedule.${index}.label`]}
                    onChange={(event) => setMilestone(index, { label: event.target.value })}
                  />
                  <Input
                    aria-label={`Milestone ${index + 1} percentage`}
                    placeholder="%"
                    inputMode="decimal"
                    value={milestone.percentage}
                    invalid={!!save.errors[`paymentSchedule.${index}.percentage`]}
                    onChange={(event) => setMilestone(index, { percentage: event.target.value })}
                  />
                  <Input
                    aria-label={`Milestone ${index + 1} due`}
                    placeholder="When it is due, e.g. On signing"
                    value={milestone.dueDescription}
                    onChange={(event) => setMilestone(index, { dueDescription: event.target.value })}
                  />
                  <div className="text-right text-sm tabular-nums">{formatMoney(amounts[index] ?? 0)}</div>
                  <button
                    type="button"
                    aria-label={`Remove milestone ${index + 1}`}
                    onClick={() => setSchedule(schedule.filter((_, at) => at !== index))}
                    className="justify-self-end rounded p-1.5 text-ink-ghost hover:bg-raised"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {save.errors[`paymentSchedule.${index}.label`] || save.errors[`paymentSchedule.${index}.percentage`] ? (
                  <div className="mt-1 text-xs text-breach">{save.errors[`paymentSchedule.${index}.label`] ?? save.errors[`paymentSchedule.${index}.percentage`]}</div>
                ) : null}
              </div>
            ))}
            <div className={`text-right text-xs ${Math.abs(percentTotal - 100) < 0.001 ? 'text-ink-faint' : 'text-breach'}`}>
              Milestones add up to {Number(percentTotal.toFixed(2))}%
            </div>
            {save.errors.paymentSchedule ? <div className="text-xs text-breach">{save.errors.paymentSchedule}</div> : null}
          </div>
        )}
      </Card>

      <Card title="Terms and notes">
        <div className="space-y-4">
          <Field label="Terms and conditions" error={save.errors.terms}>
            <Textarea rows={5} value={shownTerms} onChange={(event) => setTerms(event.target.value)} />
          </Field>
          <Field label="Notes" error={save.errors.notes} hint="Printed on the quote.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      </Card>

      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
          {quote ? 'Save changes' : 'Save as draft'}
        </Button>
        <Link to={quote ? `/quotes/${quote.id}` : '/quotes'}>
          <Button>Cancel</Button>
        </Link>
      </div>
    </Page>
  );
}

export default function QuoteForm() {
  const { id } = useParams();
  const quote = useGet<QuoteDto>(id ? `/quotes/${id}` : null);
  const { loaded } = useCompanies();
  if (!loaded || (id && quote.isPending)) return <Loading />;
  if (id && !quote.data) {
    return (
      <Page title="Quote">
        <Notice tone="error">That quote could not be loaded.</Notice>
      </Page>
    );
  }
  return <Form key={id ?? 'new'} quote={quote.data ?? null} />;
}
