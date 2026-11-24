import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hkToday, invoiceInputSchema, type InvoiceDto, type InvoiceInput } from '@hbk/shared';
import { post, put, useGet } from '../../shared/api/hooks';
import { CompanyField, useCompanies } from '../../shared/company';
import { LineItemsEditor } from '../../shared/components/LineItems';
import { ClientPicker } from '../../shared/components/pickers';
import { Button, Card, Checkbox, Field, FormGrid, Input, Loading, Notice, Page, Textarea } from '../../shared/components/ui';
import { useFormSave } from '../../shared/form';
import { discountFromDto, discountPayload, emptyLine, linesFromDto, linesPayload, type DiscountDraft, type LineDraft } from '../../shared/lines';

function Form({ invoice }: { invoice: InvoiceDto | null }) {
  const navigate = useNavigate();
  const { defaultId } = useCompanies();
  const [companyId, setCompanyId] = useState(invoice?.company.id ?? defaultId);
  const [clientId, setClientId] = useState(invoice?.client.id ?? '');
  const [title, setTitle] = useState(invoice?.title ?? '');
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? hkToday());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? '');
  const [lines, setLines] = useState<LineDraft[]>(invoice ? linesFromDto(invoice.lineItems) : [emptyLine()]);
  const [discount, setDiscount] = useState<DiscountDraft>(invoice ? discountFromDto(invoice.discountType, invoice.discountValue) : { type: 'none', value: '' });
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  // Bank details normally come from the company. They are only stored on the invoice when changed here.
  const [ownBank, setOwnBank] = useState(invoice?.ownBankDetails ?? false);
  const [bankDetails, setBankDetails] = useState(invoice?.ownBankDetails ? invoice.bankDetails : '');

  const build = useCallback(
    () => ({
      companyId: companyId || defaultId,
      clientId,
      title,
      issueDate,
      dueDate,
      lineItems: linesPayload(lines),
      ...discountPayload(discount),
      notes,
      bankDetails: ownBank ? bankDetails : null,
    }),
    [companyId, defaultId, clientId, title, issueDate, dueDate, lines, discount, notes, ownBank, bankDetails],
  );
  const send = useCallback((value: InvoiceInput) => (invoice ? put<InvoiceDto>(`/invoices/${invoice.id}`, value) : post<InvoiceDto>('/invoices', value)), [invoice]);
  const done = useCallback((saved: InvoiceDto) => navigate(`/invoices/${saved.id}`), [navigate]);
  const save = useFormSave(invoiceInputSchema, build, send, done);
  const issued = invoice !== null && invoice.status !== 'draft';

  return (
    <Page
      title={invoice ? `Edit ${invoice.number || 'draft invoice'}` : 'New invoice'}
      back={<Link to={invoice ? `/invoices/${invoice.id}` : '/invoices'} className="text-human">← Back</Link>}
    >
      {issued && invoice.amountPaid > 0 ? (
        <Notice tone="info">Payments already recorded stay on this invoice. The total cannot go below what has been received.</Notice>
      ) : null}
      <Card title="Details">
        <div className="space-y-4">
          <FormGrid>
            <CompanyField value={companyId || defaultId} onChange={setCompanyId} error={save.errors.companyId} disabled={issued} />
            <ClientPicker value={clientId} onChange={setClientId} error={save.errors.clientId} />
            <Field label="Title" error={save.errors.title} hint="Optional. Shown as the subject on the invoice.">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice date" error={save.errors.issueDate}>
                <Input type="date" value={issueDate} invalid={!!save.errors.issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </Field>
              <Field label="Due date" error={save.errors.dueDate}>
                <Input type="date" value={dueDate} invalid={!!save.errors.dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </Field>
            </div>
          </FormGrid>
        </div>
      </Card>
      <Card title="Lines">
        <LineItemsEditor lines={lines} onChange={setLines} discount={discount} onDiscountChange={setDiscount} errors={save.errors} />
      </Card>
      <Card title="Notes and bank details">
        <div className="space-y-4">
          <Field label="Notes" error={save.errors.notes} hint="Printed on the invoice.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <Checkbox label="Use different bank details on this invoice" checked={ownBank} onChange={setOwnBank} />
          {ownBank ? (
            <Field label="Bank details" error={save.errors.bankDetails}>
              <Textarea rows={4} value={bankDetails} onChange={(event) => setBankDetails(event.target.value)} />
            </Field>
          ) : (
            <div className="text-xs text-ink-faint">The company’s bank details from Settings are printed.</div>
          )}
        </div>
      </Card>
      {save.message ? <Notice tone="error">{save.message}</Notice> : null}
      <div className="flex gap-2">
        <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
          {invoice ? 'Save changes' : 'Save as draft'}
        </Button>
        <Link to={invoice ? `/invoices/${invoice.id}` : '/invoices'}>
          <Button>Cancel</Button>
        </Link>
      </div>
    </Page>
  );
}

export default function InvoiceForm() {
  const { id } = useParams();
  const invoice = useGet<InvoiceDto>(id ? `/invoices/${id}` : null);
  const { loaded } = useCompanies();
  if (!loaded || (id && invoice.isPending)) return <Loading />;
  if (id && !invoice.data) {
    return (
      <Page title="Invoice">
        <Notice tone="error">That invoice could not be loaded.</Notice>
      </Page>
    );
  }
  return <Form key={id ?? 'new'} invoice={invoice.data ?? null} />;
}
