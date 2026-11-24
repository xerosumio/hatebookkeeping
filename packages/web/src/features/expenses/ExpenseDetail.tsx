import { Link, useParams } from 'react-router-dom';
import { formatDate, formatMoney, type ExpenseDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useCompanies } from '../../shared/company';
import { FileLink } from '../../shared/components/files';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, DetailRow, Loading, Notice, Page, Table } from '../../shared/components/ui';
import { BackLink, FlowActions, FlowNotices, FlowSide } from './flow';

export default function ExpenseDetail() {
  const { id } = useParams();
  const query = useGet<ExpenseDto>(`/expenses/${id}`);
  const { all } = useCompanies();

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Expense" back={<BackLink to="/expenses">Expenses</BackLink>}>
        <Notice tone="error">That expense could not be loaded.</Notice>
      </Page>
    );
  }
  const expense = query.data;

  return (
    <Page
      title={
        <span className="flex flex-wrap items-center gap-3">
          {expense.number}
          <StatusBadge status={expense.status} />
        </span>
      }
      subtitle={`${expense.payee?.name ?? ''} · ${expense.title}`}
      back={<BackLink to="/expenses">Expenses</BackLink>}
      actions={
        <FlowActions
          base="/expenses"
          expense={expense}
          extra={
            expense.actions.includes('edit') ? (
              <Link to={`/expenses/${expense.id}/edit`}>
                <Button>Edit</Button>
              </Link>
            ) : null
          }
        />
      }
    >
      <FlowNotices expense={expense} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padded={false} title="Lines">
            <Table
              rows={expense.items.map((item, index) => ({ ...item, index }))}
              rowKey={(item) => String(item.index)}
              columns={[
                { key: 'description', header: 'Description', cell: (item) => item.description },
                { key: 'category', header: 'Category', cell: (item) => item.categoryName },
                { key: 'amount', header: 'Amount', align: 'right', cell: (item) => formatMoney(item.amount) },
              ]}
              footer={
                <tr className="border-t border-hair">
                  <td colSpan={2} className="px-4 py-2.5 text-right text-sm text-ink-faint">
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(expense.total)}</td>
                </tr>
              }
            />
          </Card>
          {expense.attachmentIds.length > 0 ? (
            <Card title="Attachments">
              <div className="flex flex-wrap gap-2">
                {expense.attachmentIds.map((fileId, index) => (
                  <FileLink key={fileId} fileId={fileId} label={`Attachment ${index + 1}`} />
                ))}
              </div>
            </Card>
          ) : null}
          {expense.notes ? (
            <Card title="Notes">
              <div className="whitespace-pre-wrap text-sm text-ink-dim">{expense.notes}</div>
            </Card>
          ) : null}
        </div>
        <div className="space-y-5">
          <Card title="Summary">
            <DetailRow label="Total">
              <span className="font-semibold">{formatMoney(expense.total)}</span>
            </DetailRow>
            <DetailRow label="Payee">{expense.payee?.name ?? '—'}</DetailRow>
            <DetailRow label="Expense date">{formatDate(expense.expenseDate)}</DetailRow>
            <DetailRow label="Due date">{formatDate(expense.dueDate) || '—'}</DetailRow>
            {all.length > 1 ? <DetailRow label="Company">{expense.company.name}</DetailRow> : null}
            <DetailRow label="Entered by">{expense.createdBy.name}</DetailRow>
          </Card>
          <FlowSide expense={expense} />
        </div>
      </div>
    </Page>
  );
}
