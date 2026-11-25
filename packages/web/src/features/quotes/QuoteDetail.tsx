import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatMoney, type InvoiceDto, type QuoteAction, type QuoteDto } from '@hbk/shared';
import { del, post, useGet, useSave } from '../../shared/api/hooks';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { OpenButton } from '../../shared/components/files';
import { LineItemsTable } from '../../shared/components/LineItems';
import { ApprovalSummary, History, StatusBadge } from '../../shared/components/status';
import { Button, Card, DetailRow, Loading, Notice, Page, Table } from '../../shared/components/ui';

const NEXT_STEP: Partial<Record<QuoteDto['status'], string>> = {
  draft: 'Submit this quote for approval. It cannot be sent until it is approved.',
  pending_approval: 'Waiting for approval.',
  approved: 'Approved. Download the PDF, send it to the client, then mark it as sent.',
  sent: 'Sent. Record whether the client accepted or declined.',
  accepted: 'Accepted. Create the invoice from here.',
};

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const query = useGet<QuoteDto>(`/quotes/${id}`);
  const [dialog, setDialog] = useState<'reject' | 'delete' | 'revise' | null>(null);
  const close = useCallback(() => setDialog(null), []);

  const step = useSave((action: string) => post(`/quotes/${id}/${action}`));
  const reject = useSave((reason: string) => post(`/quotes/${id}/reject`, { reason }), close);
  const revise = useSave(() => post(`/quotes/${id}/revise`), close);
  const remove = useSave(
    () => del(`/quotes/${id}`),
    () => navigate('/quotes'),
  );
  const convert = useSave(
    (milestoneId: string | null) => post<InvoiceDto>(`/quotes/${id}/invoices`, { milestoneId }),
    (invoice) => navigate(`/invoices/${invoice.id}`),
  );

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Quote" back={<Link to="/quotes" className="text-human">← Quotes</Link>}>
        <Notice tone="error">That quote could not be loaded.</Notice>
      </Page>
    );
  }
  const quote = query.data;
  const has = (action: QuoteAction) => quote.actions.includes(action);
  const stepButton = (action: QuoteAction, label: string, primary = false) =>
    has(action) ? (
      <Button variant={primary ? 'primary' : 'secondary'} busy={step.busy} onClick={() => void step.run(action)}>
        {label}
      </Button>
    ) : null;

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {quote.number}
          <StatusBadge status={quote.status} />
        </span>
      }
      subtitle={`${quote.client.name} · ${quote.title}`}
      back={<Link to="/quotes" className="text-human">← Quotes</Link>}
      actions={
        <>
          <OpenButton path={`/quotes/${quote.id}/pdf`}>PDF</OpenButton>
          {has('edit') ? (
            <Link to={`/quotes/${quote.id}/edit`}>
              <Button>Edit</Button>
            </Link>
          ) : null}
          {has('delete') ? (
            <Button variant="danger" onClick={() => setDialog('delete')}>
              Delete draft
            </Button>
          ) : null}
          {has('revise') ? <Button onClick={() => setDialog('revise')}>Take back to draft</Button> : null}
          {has('reject') ? (
            <Button variant="danger" onClick={() => setDialog('reject')}>
              Reject
            </Button>
          ) : null}
          {stepButton('submit', 'Submit for approval', true)}
          {stepButton('approve', 'Approve', true)}
          {stepButton('send', 'Mark as sent', true)}
          {stepButton('decline', 'Client declined')}
          {stepButton('accept', 'Client accepted', true)}
          {has('convert') && quote.paymentSchedule.length === 0 ? (
            <Button variant="primary" busy={convert.busy} onClick={() => void convert.run(null)}>
              Create invoice
            </Button>
          ) : null}
        </>
      }
    >
      {step.failure ? <Notice tone="error">{step.failure.message}</Notice> : null}
      {convert.failure ? <Notice tone="error">{convert.failure.message}</Notice> : null}
      {quote.status === 'draft' && quote.rejectionReason ? <Notice tone="warning">Rejected: {quote.rejectionReason}</Notice> : null}
      {NEXT_STEP[quote.status] ? <Notice tone="info">{NEXT_STEP[quote.status]}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false} title="Lines">
            <LineItemsTable lines={quote.lineItems} subtotal={quote.subtotal} discount={quote.discount} total={quote.total} />
          </Card>

          {quote.paymentSchedule.length > 0 ? (
            <Card padded={false} title="Payment schedule">
              <Table
                rows={quote.paymentSchedule}
                rowKey={(milestone) => milestone.id}
                columns={[
                  {
                    key: 'label',
                    header: 'Milestone',
                    cell: (milestone) => (
                      <div>
                        <div className="font-medium">{milestone.label}</div>
                        {milestone.dueDescription ? <div className="text-xs text-ink-faint">{milestone.dueDescription}</div> : null}
                      </div>
                    ),
                  },
                  { key: 'pct', header: '%', align: 'right', cell: (milestone) => `${milestone.percentage}%` },
                  { key: 'amount', header: 'Amount', align: 'right', cell: (milestone) => formatMoney(milestone.amount) },
                  {
                    key: 'invoice',
                    header: 'Invoice',
                    align: 'right',
                    cell: (milestone) =>
                      milestone.invoice ? (
                        <Link to={`/invoices/${milestone.invoice.id}`} className="text-human underline">
                          {milestone.invoice.number || 'Draft'}
                        </Link>
                      ) : has('convert') ? (
                        <Button size="sm" busy={convert.busy} onClick={() => void convert.run(milestone.id)}>
                          Create invoice
                        </Button>
                      ) : (
                        <span className="text-ink-ghost">Not invoiced</span>
                      ),
                  },
                ]}
              />
            </Card>
          ) : null}

          {quote.terms ? (
            <Card title="Terms and conditions">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{quote.terms}</div>
            </Card>
          ) : null}
          {quote.notes ? (
            <Card title="Notes">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{quote.notes}</div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <DetailRow label="Total">
              <span className="font-semibold">{formatMoney(quote.total)}</span>
            </DetailRow>
            <DetailRow label="Quote date">{formatDate(quote.issueDate)}</DetailRow>
            <DetailRow label="Valid until">{formatDate(quote.validUntil) || '—'}</DetailRow>
            <DetailRow label="Company">{quote.company.name}</DetailRow>
            <DetailRow label="Client">{quote.client.name}</DetailRow>
            {quote.invoice ? (
              <DetailRow label="Invoice">
                <Link to={`/invoices/${quote.invoice.id}`} className="text-human underline">
                  {quote.invoice.number || 'Draft invoice'}
                </Link>
              </DetailRow>
            ) : null}
            <DetailRow label="Created by">{quote.createdBy.name}</DetailRow>
          </Card>
          <Card title="Approval">
            <ApprovalSummary approvals={quote.approvals} required={quote.approvalsRequired} />
            {quote.status === 'pending_approval' && !has('approve') ? (
              <div className="mt-2 text-xs text-ink-faint">You cannot approve this: either you prepared it, you already approved it, or you are not an approver.</div>
            ) : null}
          </Card>
          <History activity={quote.activity} />
        </div>
      </div>

      {dialog === 'reject' ? (
        <ConfirmDialog
          title={`Reject ${quote.number}?`}
          confirmLabel="Reject"
          danger
          reason={{ label: 'What needs to change?', required: true }}
          busy={reject.busy}
          failure={reject.failure}
          onConfirm={(reason) => void reject.run(reason)}
          onClose={close}
        >
          The quote goes back to draft and its author is told why.
        </ConfirmDialog>
      ) : null}
      {dialog === 'revise' ? (
        <ConfirmDialog title="Take this quote back to draft?" confirmLabel="Take back to draft" busy={revise.busy} failure={revise.failure} onConfirm={() => void revise.run()} onClose={close}>
          It can then be edited. Its approvals are cleared, so it must be approved again before it can be sent.
        </ConfirmDialog>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmDialog title="Delete this draft?" confirmLabel="Delete draft" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={close} />
      ) : null}
    </Page>
  );
}
