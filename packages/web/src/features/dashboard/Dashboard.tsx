import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PNL_BASIS_LABELS, formatDate, formatMoney, monthLabel, type DashboardDto, type ExpenseKind, type PnlTotalsDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { useCompanies } from '../../shared/company';
import { StatusBadge } from '../../shared/components/status';
import { Card, Loading, Notice, Page } from '../../shared/components/ui';

const KIND_LABEL: Record<'quote' | ExpenseKind, string> = { quote: 'Quote', expense: 'Expense', claim: 'Claim', salary: 'Salary run' };
const KIND_PATH: Record<'quote' | ExpenseKind, string> = { quote: '/quotes', expense: '/expenses', claim: '/claims', salary: '/salary/runs' };

function Totals({ title, month, labels, totals }: { title: string; month: string; labels: [string, string]; totals: PnlTotalsDto }) {
  const cell = (label: string, amount: number, tone = 'text-ink') => (
    <div>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{formatMoney(amount)}</div>
    </div>
  );
  return (
    <Card
      title={title}
      right={
        <Link to={`/pnl?month=${month}`} className="text-xs text-human underline">
          Open the P&amp;L
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        {cell(labels[0], totals.income)}
        {cell(labels[1], totals.expenses)}
        {cell('Profit or loss', totals.net, totals.net < 0 ? 'text-breach' : 'text-authored')}
      </div>
    </Card>
  );
}

function Rows<T>({ rows, empty, row }: { rows: T[]; empty: string; row: (item: T) => { key: string; to: string; main: ReactNode; sub?: ReactNode; right: ReactNode } }) {
  if (rows.length === 0) return <div className="px-4 py-6 text-center text-sm text-ink-ghost">{empty}</div>;
  return (
    <ul>
      {rows.map((item) => {
        const { key, to, main, sub, right } = row(item);
        return (
          <li key={key} className="border-b border-hair/60 last:border-0">
            <Link to={to} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-raised">
              <span className="min-w-0">
                <span className="block truncate text-ink">{main}</span>
                {sub ? <span className="block truncate text-xs text-ink-faint">{sub}</span> : null}
              </span>
              <span className="shrink-0 text-right tabular-nums text-ink">{right}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Dashboard() {
  const { can } = useAuth();
  const { selectedId } = useCompanies();
  const query = useGet<DashboardDto>('/dashboard', { companyId: selectedId });

  if (query.isPending) return <Loading />;
  if (!query.data) {
    return (
      <Page title="Dashboard">
        <Notice tone="error">Could not load the dashboard.</Notice>
      </Page>
    );
  }
  const data = query.data;
  const admin = can('settings.manage');
  const forMe = data.waitingForApproval.filter((item) => item.mine).length;

  return (
    <Page title="Dashboard" subtitle={monthLabel(data.month)}>
      {!data.setup.hasCompany ? (
        <Notice tone="warning">
          No company is set up yet, so nothing can be entered.{' '}
          {admin ? (
            <Link to="/settings" className="underline">
              Add your company in Settings
            </Link>
          ) : (
            'An admin adds it in Settings.'
          )}
        </Notice>
      ) : null}
      {data.setup.hasCompany && !data.setup.hasApprovers ? (
        <Notice tone="warning">
          No approvers are chosen yet, so quotes, expenses, claims and salary cannot be submitted.{' '}
          {admin ? (
            <Link to="/settings" className="underline">
              Choose approvers in Settings
            </Link>
          ) : (
            'An admin chooses them in Settings.'
          )}
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Totals title={`${PNL_BASIS_LABELS.cash} this month`} month={data.month} labels={['Cash in', 'Cash out']} totals={data.cash} />
        <Totals title={`${PNL_BASIS_LABELS.billed} this month`} month={data.month} labels={['Billed', 'Committed']} totals={data.billed} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          padded={false}
          title="Unpaid invoices"
          right={
            <span className="text-xs text-ink-faint">
              {data.unpaidInvoices.count} owing {formatMoney(data.unpaidInvoices.total)}
              {data.unpaidInvoices.overdueCount > 0 ? (
                <span className="text-breach">
                  {' '}
                  · {data.unpaidInvoices.overdueCount} overdue, {formatMoney(data.unpaidInvoices.overdueTotal)}
                </span>
              ) : null}
            </span>
          }
        >
          <Rows
            rows={data.unpaidInvoices.items}
            empty="Nothing is owed to you."
            row={(invoice) => ({
              key: invoice.id,
              to: `/invoices/${invoice.id}`,
              main: `${invoice.number} · ${invoice.clientName}`,
              sub: invoice.dueDate ? (
                <span className={invoice.overdue ? 'text-breach' : ''}>
                  {invoice.overdue ? 'Was due' : 'Due'} {formatDate(invoice.dueDate)}
                </span>
              ) : (
                'No due date'
              ),
              right: formatMoney(invoice.amountDue),
            })}
          />
          {data.unpaidInvoices.count > data.unpaidInvoices.items.length ? (
            <div className="border-t border-hair px-4 py-2 text-xs">
              <Link to="/invoices" className="text-human underline">
                See all {data.unpaidInvoices.count}
              </Link>
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card padded={false} title="Waiting for approval" right={forMe > 0 ? <StatusBadge status="pending_approval" /> : null}>
            <Rows
              rows={data.waitingForApproval}
              empty="Nothing is waiting for approval."
              row={(item) => ({
                key: `${item.kind}-${item.id}`,
                to: `${KIND_PATH[item.kind]}/${item.id}`,
                main: `${item.number} · ${item.title}`,
                sub: item.mine ? <span className="text-signal">{KIND_LABEL[item.kind]} · waiting for you</span> : `${KIND_LABEL[item.kind]} · waiting for another approver`,
                right: formatMoney(item.total),
              })}
            />
          </Card>
          <Card padded={false} title="Approved, to be paid">
            <Rows
              rows={data.waitingForPayment}
              empty="Nothing is waiting to be paid."
              row={(item) => ({
                key: item.id,
                to: `${KIND_PATH[item.kind]}/${item.id}`,
                main: `${item.number} · ${item.title}`,
                sub: `${KIND_LABEL[item.kind]}${item.dueDate ? ` · due ${formatDate(item.dueDate)}` : ''}`,
                right: formatMoney(item.total),
              })}
            />
          </Card>
          {data.recurringDue.length > 0 ? (
            <Card padded={false} title="Recurring items due">
              <Rows
                rows={data.recurringDue}
                empty=""
                row={(item) => ({
                  key: `${item.id}-${item.period}`,
                  to: '/recurring',
                  main: item.name,
                  sub: `For ${formatDate(item.period)}`,
                  right: <StatusBadge status={item.state} />,
                })}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
