import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatDate, formatMoney, type InvoiceDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { useCompanies } from '../../shared/company';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Loading, Notice, Page, Select, Table } from '../../shared/components/ui';

const FILTERS = [
  ['', 'All'],
  ['open', 'Unpaid and part paid'],
  ['overdue', 'Overdue'],
  ['draft', 'Drafts'],
  ['paid', 'Paid'],
  ['cancelled', 'Cancelled'],
] as const;

export default function Invoices() {
  const { can } = useAuth();
  const { selectedId, companies } = useCompanies();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const invoices = useGet<InvoiceDto[]>('/invoices', { status, companyId: selectedId });
  const rows = invoices.data ?? [];
  const owed = rows.reduce((sum, invoice) => sum + (invoice.status === 'unpaid' || invoice.status === 'partial' ? invoice.amountDue : 0), 0);

  return (
    <Page
      title="Invoices"
      subtitle={rows.length > 0 ? `${formatMoney(owed)} still owed on the invoices shown` : undefined}
      actions={
        can('invoices.manage') ? (
          <Link to="/invoices/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New invoice
            </Button>
          </Link>
        ) : null
      }
    >
      <Card
        padded={false}
        title={
          <Select aria-label="Show" className="!w-auto" value={status} onChange={(event) => setStatus(event.target.value)}>
            {FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      >
        {invoices.isPending ? (
          <Loading />
        ) : invoices.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the invoices.</Notice>
          </div>
        ) : (
          <Table
            rows={rows}
            rowKey={(invoice) => invoice.id}
            onRowClick={(invoice) => navigate(`/invoices/${invoice.id}`)}
            empty={status ? 'No invoices match.' : 'No invoices yet.'}
            columns={[
              { key: 'number', header: 'Number', cell: (invoice) => <span className="font-medium">{invoice.number || 'Draft'}</span> },
              {
                key: 'client',
                header: 'Client',
                cell: (invoice) => (
                  <div>
                    <div>{invoice.client.name}</div>
                    {invoice.title ? <div className="text-xs text-ink-faint">{invoice.title}</div> : null}
                  </div>
                ),
              },
              ...(companies.length > 1 ? [{ key: 'company', header: 'Company', cell: (invoice: InvoiceDto) => invoice.company.name }] : []),
              { key: 'date', header: 'Date', cell: (invoice) => formatDate(invoice.issueDate) },
              {
                key: 'due',
                header: 'Due',
                cell: (invoice) => <span className={invoice.overdue ? 'text-breach' : ''}>{formatDate(invoice.dueDate) || '—'}</span>,
              },
              { key: 'total', header: 'Total', align: 'right', cell: (invoice) => formatMoney(invoice.total) },
              { key: 'owed', header: 'Still owed', align: 'right', cell: (invoice) => (invoice.status === 'draft' ? '—' : formatMoney(invoice.amountDue)) },
              { key: 'status', header: 'Status', cell: (invoice) => <StatusBadge status={invoice.overdue ? 'overdue' : invoice.status} /> },
            ]}
          />
        )}
      </Card>
    </Page>
  );
}
