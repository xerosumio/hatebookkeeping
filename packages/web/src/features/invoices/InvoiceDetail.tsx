import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  centsToInput,
  formatDate,
  formatMoney,
  hkToday,
  paymentInputSchema,
  type InvoiceDto,
  type PaymentDto,
  type PaymentInput,
  type PaymentMethod,
} from '@hbk/shared';
import { del, post, useGet, useSave } from '../../shared/api/hooks';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { OpenButton } from '../../shared/components/files';
import { LineItemsTable } from '../../shared/components/LineItems';
import { History, StatusBadge } from '../../shared/components/status';
import { Button, Card, DetailRow, Field, FormGrid, Input, Loading, Modal, MoneyInput, Notice, Page, Select, Table, Textarea } from '../../shared/components/ui';
import { centsOf, useFormSave } from '../../shared/form';

function PaymentDialog({ invoice, onClose }: { invoice: InvoiceDto; onClose: () => void }) {
  const [amount, setAmount] = useState(centsToInput(invoice.amountDue));
  const [date, setDate] = useState(hkToday());
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const build = useCallback(() => ({ amount: centsOf(amount), date, method, reference, notes }), [amount, date, method, reference, notes]);
  const send = useCallback((value: PaymentInput) => post(`/invoices/${invoice.id}/payments`, value), [invoice.id]);
  const save = useFormSave(paymentInputSchema, build, send, onClose);

  return (
    <Modal
      title={`Record a payment on ${invoice.number}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-dim">{formatMoney(invoice.amountDue)} is still owed.</div>
      <FormGrid>
        <Field label="Amount received" error={save.errors.amount}>
          <MoneyInput value={amount} invalid={!!save.errors.amount} autoFocus onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Date received" error={save.errors.date}>
          <Input type="date" value={date} max={hkToday()} invalid={!!save.errors.date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Method" error={save.errors.method}>
          <Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" error={save.errors.reference} hint="Bank reference or cheque number">
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
      </FormGrid>
      <Field label="Notes" error={save.errors.notes} hint="Printed on the receipt.">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
    </Modal>
  );
}

type Dialog = 'payment' | 'cancel' | 'delete' | { voiding: PaymentDto } | null;

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useGet<InvoiceDto>(`/invoices/${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  const issue = useSave(() => post(`/invoices/${id}/issue`));
  const cancel = useSave((reason: string) => post(`/invoices/${id}/cancel`, { reason }), close);
  const remove = useSave(
    () => del(`/invoices/${id}`),
    () => navigate('/invoices'),
  );
  const voidPayment = useSave((input: { paymentId: string; reason: string }) => post(`/payments/${input.paymentId}/void`, { reason: input.reason }), close);

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Invoice" back={<Link to="/invoices" className="text-human">← Invoices</Link>}>
        <Notice tone="error">That invoice could not be loaded.</Notice>
      </Page>
    );
  }
  const invoice = query.data;
  const has = (action: InvoiceDto['actions'][number]) => invoice.actions.includes(action);

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {invoice.number || 'Draft invoice'}
          <StatusBadge status={invoice.overdue ? 'overdue' : invoice.status} />
        </span>
      }
      subtitle={`${invoice.client.name}${invoice.title ? ` · ${invoice.title}` : ''}`}
      back={<Link to="/invoices" className="text-human">← Invoices</Link>}
      actions={
        <>
          <OpenButton path={`/invoices/${invoice.id}/pdf`}>PDF</OpenButton>
          {has('edit') ? (
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button>Edit</Button>
            </Link>
          ) : null}
          {has('delete') ? (
            <Button variant="danger" onClick={() => setDialog('delete')}>
              Delete draft
            </Button>
          ) : null}
          {has('cancel') ? (
            <Button variant="danger" onClick={() => setDialog('cancel')}>
              Cancel invoice
            </Button>
          ) : null}
          {has('issue') ? (
            <Button variant="primary" busy={issue.busy} onClick={() => void issue.run()}>
              Issue invoice
            </Button>
          ) : null}
          {has('recordPayment') ? (
            <Button variant="primary" onClick={() => setDialog('payment')}>
              Record payment
            </Button>
          ) : null}
        </>
      }
    >
      {issue.failure ? <Notice tone="error">{issue.failure.message}</Notice> : null}
      {invoice.status === 'draft' ? <Notice tone="info">This is a draft. It gets its invoice number when you issue it, and only then counts in “Billed”.</Notice> : null}
      {invoice.status === 'paid' ? <Notice tone="success">Paid in full. A paid invoice is locked.</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false} title="Lines">
            <LineItemsTable lines={invoice.lineItems} subtotal={invoice.subtotal} discount={invoice.discount} total={invoice.total} />
          </Card>

          <Card padded={false} title="Payments">
            <Table
              rows={invoice.payments}
              rowKey={(payment) => payment.id}
              empty="No payments recorded."
              columns={[
                { key: 'number', header: 'Receipt', cell: (payment) => <span className={payment.voided ? 'text-ink-ghost line-through' : 'font-medium'}>{payment.number}</span> },
                { key: 'date', header: 'Date', cell: (payment) => formatDate(payment.date) },
                {
                  key: 'method',
                  header: 'Method',
                  cell: (payment) => (
                    <div>
                      {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.reference ? <span className="text-ink-faint"> · {payment.reference}</span> : null}
                      {payment.voided ? <div className="text-xs text-ink-faint">Voided: {payment.voidReason}</div> : null}
                    </div>
                  ),
                },
                { key: 'amount', header: 'Amount', align: 'right', cell: (payment) => <span className={payment.voided ? 'text-ink-ghost line-through' : ''}>{formatMoney(payment.amount)}</span> },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (payment) => (
                    <span className="inline-flex items-center gap-1">
                      <OpenButton path={`/payments/${payment.id}/pdf`} size="sm" variant="ghost">
                        Receipt
                      </OpenButton>
                      {payment.canVoid ? (
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ voiding: payment })}>
                          Void
                        </Button>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
          {invoice.notes ? (
            <Card title="Notes">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{invoice.notes}</div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <DetailRow label="Total">{formatMoney(invoice.total)}</DetailRow>
            <DetailRow label="Received">{formatMoney(invoice.amountPaid)}</DetailRow>
            <DetailRow label="Still owed">
              <span className="font-semibold">{formatMoney(invoice.amountDue)}</span>
            </DetailRow>
            <DetailRow label="Invoice date">{formatDate(invoice.issueDate)}</DetailRow>
            <DetailRow label="Due date">{formatDate(invoice.dueDate) || '—'}</DetailRow>
            <DetailRow label="Company">{invoice.company.name}</DetailRow>
            <DetailRow label="Client">{invoice.client.name}</DetailRow>
            {invoice.quote ? (
              <DetailRow label="From quote">
                <Link to={`/quotes/${invoice.quote.id}`} className="text-human underline">
                  {invoice.quote.number}
                </Link>
                {invoice.milestoneLabel ? <div className="text-xs text-ink-faint">{invoice.milestoneLabel}</div> : null}
              </DetailRow>
            ) : null}
            <DetailRow label="Created by">{invoice.createdBy.name}</DetailRow>
          </Card>
          <Card title="Bank details on the invoice">
            {invoice.bankDetails ? (
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{invoice.bankDetails}</div>
            ) : (
              <div className="text-sm text-signal">None. An admin can add the company’s bank details in Settings.</div>
            )}
          </Card>
          <History activity={invoice.activity} />
        </div>
      </div>

      {dialog === 'payment' ? <PaymentDialog invoice={invoice} onClose={close} /> : null}
      {dialog === 'cancel' ? (
        <ConfirmDialog
          title={`Cancel ${invoice.number}?`}
          confirmLabel="Cancel invoice"
          danger
          reason={{ label: 'Why is it being cancelled?', required: true }}
          busy={cancel.busy}
          failure={cancel.failure}
          onConfirm={(reason) => void cancel.run(reason)}
          onClose={close}
        >
          The invoice keeps its number and stays on file as cancelled. It no longer counts in the P&L.
        </ConfirmDialog>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmDialog title="Delete this draft?" confirmLabel="Delete draft" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={close} />
      ) : null}
      {dialog && typeof dialog === 'object' ? (
        <ConfirmDialog
          title={`Void receipt ${dialog.voiding.number}?`}
          confirmLabel="Void payment"
          danger
          reason={{ label: 'Why is it being voided?', required: true }}
          busy={voidPayment.busy}
          failure={voidPayment.failure}
          onConfirm={(reason) => void voidPayment.run({ paymentId: dialog.voiding.id, reason })}
          onClose={close}
        >
          {formatMoney(dialog.voiding.amount)} will be owed on the invoice again. The receipt stays on file, marked void.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}
