import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatDate, formatMoney, type ExpenseDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { useCompanies } from '../../shared/company';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Loading, Notice, Page, Table } from '../../shared/components/ui';
import { StatusFilter } from './flow';

export default function Expenses() {
  const { can } = useAuth();
  const { selectedId, companies } = useCompanies();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const expenses = useGet<ExpenseDto[]>('/expenses', { status, companyId: selectedId });
  const rows = expenses.data ?? [];
  const total = rows.reduce((sum, expense) => sum + (expense.status === 'reversed' ? 0 : expense.total), 0);

  return (
    <Page
      title="Expenses"
      subtitle={rows.length > 0 ? `${formatMoney(total)} across the expenses shown` : 'Bills and supplier payments. Each one is approved before it is paid.'}
      actions={
        can('expenses.manage') ? (
          <Link to="/expenses/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New expense
            </Button>
          </Link>
        ) : null
      }
    >
      <Card padded={false} title={<StatusFilter value={status} onChange={setStatus} />}>
        {expenses.isPending ? (
          <Loading />
        ) : expenses.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the expenses.</Notice>
          </div>
        ) : (
          <Table
            rows={rows}
            rowKey={(expense) => expense.id}
            onRowClick={(expense) => navigate(`/expenses/${expense.id}`)}
            empty={status ? 'No expenses match.' : 'No expenses yet.'}
            columns={[
              { key: 'number', header: 'Number', cell: (expense) => <span className="font-medium">{expense.number}</span> },
              {
                key: 'title',
                header: 'Expense',
                cell: (expense) => (
                  <div>
                    <div>{expense.title}</div>
                    <div className="text-xs text-ink-faint">{expense.payee?.name}</div>
                  </div>
                ),
              },
              ...(companies.length > 1 ? [{ key: 'company', header: 'Company', cell: (expense: ExpenseDto) => expense.company.name }] : []),
              { key: 'date', header: 'Date', cell: (expense) => formatDate(expense.expenseDate) },
              { key: 'due', header: 'Due', cell: (expense) => formatDate(expense.dueDate) || '—' },
              { key: 'total', header: 'Total', align: 'right', cell: (expense) => formatMoney(expense.total) },
              { key: 'status', header: 'Status', cell: (expense) => <StatusBadge status={expense.status} /> },
            ]}
          />
        )}
      </Card>
    </Page>
  );
}
