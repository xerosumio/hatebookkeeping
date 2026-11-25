import { Link, useParams } from 'react-router-dom';
import { formatDate, formatMoney, type ExpenseDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useCompanies } from '../../shared/company';
import { FileLink } from '../../shared/components/files';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, DetailRow, Loading, Notice, Page, Table } from '../../shared/components/ui';
import { BackLink, FlowActions, FlowNotices, FlowSide } from '../expenses/flow';

export default function ClaimDetail() {
  const { id } = useParams();
  const query = useGet<ExpenseDto>(`/claims/${id}`);
  const { all } = useCompanies();

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Claim" back={<BackLink to="/claims">Claims</BackLink>}>
        <Notice tone="error">That claim could not be loaded.</Notice>
      </Page>
    );
  }
  const claim = query.data;

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {claim.number}
          <StatusBadge status={claim.status} />
        </span>
      }
      subtitle={`${claim.claimant?.name ?? ''} · ${claim.title}`}
      back={<BackLink to="/claims">Claims</BackLink>}
      actions={
        <FlowActions
          base="/claims"
          expense={claim}
          extra={
            claim.actions.includes('edit') ? (
              <Link to={`/claims/${claim.id}/edit`}>
                <Button>Edit</Button>
              </Link>
            ) : null
          }
        />
      }
    >
      <FlowNotices expense={claim} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false} title="Receipts">
            <Table
              rows={claim.items.map((item, index) => ({ ...item, index }))}
              rowKey={(item) => String(item.index)}
              columns={[
                { key: 'date', header: 'Date', cell: (item) => formatDate(item.date) },
                { key: 'description', header: 'Description', cell: (item) => item.description },
                { key: 'category', header: 'Category', cell: (item) => item.categoryName },
                {
                  key: 'receipt',
                  header: 'Receipt',
                  cell: (item) => (item.receiptFileId ? <FileLink fileId={item.receiptFileId} label="View" /> : <span className="text-breach">Missing</span>),
                },
                { key: 'amount', header: 'Amount', align: 'right', cell: (item) => formatMoney(item.amount) },
              ]}
              footer={
                <tr className="border-t border-hair">
                  <td colSpan={4} className="px-4 py-2.5 text-right text-sm text-ink-faint">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(claim.total)}</td>
                </tr>
              }
            />
          </Card>
          {claim.notes ? (
            <Card title="Notes">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{claim.notes}</div>
            </Card>
          ) : null}
        </div>
        <div className="space-y-5">
          <Card title="Summary">
            <DetailRow label="Total">
              <span className="font-semibold">{formatMoney(claim.total)}</span>
            </DetailRow>
            <DetailRow label="Claimed by">{claim.claimant?.name ?? '—'}</DetailRow>
            {all.length > 1 ? <DetailRow label="Company">{claim.company.name}</DetailRow> : null}
          </Card>
          <FlowSide expense={claim} />
        </div>
      </div>
    </Page>
  );
}
