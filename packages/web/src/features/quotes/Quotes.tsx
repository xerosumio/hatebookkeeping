import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { QUOTE_STATUSES, formatDate, formatMoney, type QuoteDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { useCompanies } from '../../shared/company';
import { StatusBadge, statusLabel } from '../../shared/components/status';
import { Button, Card, Loading, Notice, Page, Select, Table } from '../../shared/components/ui';

export default function Quotes() {
  const { can } = useAuth();
  const { selectedId, companies } = useCompanies();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const quotes = useGet<QuoteDto[]>('/quotes', { status, companyId: selectedId });

  return (
    <Page
      title="Quotes"
      actions={
        can('quotes.manage') ? (
          <Link to="/quotes/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New quote
            </Button>
          </Link>
        ) : null
      }
    >
      <Card
        padded={false}
        title={
          <Select aria-label="Show" className="!w-auto" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {QUOTE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </Select>
        }
      >
        {quotes.isPending ? (
          <Loading />
        ) : quotes.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the quotes.</Notice>
          </div>
        ) : (
          <Table
            rows={quotes.data}
            rowKey={(quote) => quote.id}
            onRowClick={(quote) => navigate(`/quotes/${quote.id}`)}
            empty={status ? 'No quotes match.' : 'No quotes yet.'}
            columns={[
              { key: 'number', header: 'Number', cell: (quote) => <span className="font-medium">{quote.number}</span> },
              {
                key: 'client',
                header: 'Client',
                cell: (quote) => (
                  <div>
                    <div>{quote.client.name}</div>
                    <div className="text-xs text-ink-faint">{quote.title}</div>
                  </div>
                ),
              },
              ...(companies.length > 1 ? [{ key: 'company', header: 'Company', cell: (quote: QuoteDto) => quote.company.name }] : []),
              { key: 'date', header: 'Date', cell: (quote) => formatDate(quote.issueDate) },
              { key: 'total', header: 'Total', align: 'right', cell: (quote) => formatMoney(quote.total) },
              { key: 'status', header: 'Status', cell: (quote) => <StatusBadge status={quote.status} /> },
            ]}
          />
        )}
      </Card>
    </Page>
  );
}
