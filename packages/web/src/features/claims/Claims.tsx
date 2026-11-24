import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatDate, formatMoney, type ExpenseDto } from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useAuth } from '../../shared/auth';
import { useCompanies } from '../../shared/company';
import { StatusBadge } from '../../shared/components/status';
import { Button, Card, Checkbox, Loading, Notice, Page, Table } from '../../shared/components/ui';
import { StatusFilter } from '../expenses/flow';

export default function Claims() {
  const { can } = useAuth();
  const { selectedId } = useCompanies();
  const navigate = useNavigate();
  const seesAll = can('claims.viewAll');
  const [status, setStatus] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const claims = useGet<ExpenseDto[]>('/claims', { status, companyId: selectedId, mine: seesAll && onlyMine ? 'true' : undefined });
  const rows = claims.data ?? [];

  return (
    <Page
      title="Claims"
      subtitle={seesAll ? 'Money staff paid themselves and are claiming back.' : 'Money you paid yourself and are claiming back. Only you and the office can see your claims.'}
      actions={
        <Link to="/claims/new">
          <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
            New claim
          </Button>
        </Link>
      }
    >
      <Card
        padded={false}
        title={<StatusFilter value={status} onChange={setStatus} />}
        right={seesAll ? <Checkbox label="Only my own" checked={onlyMine} onChange={setOnlyMine} /> : null}
      >
        {claims.isPending ? (
          <Loading />
        ) : claims.isError ? (
          <div className="p-4">
            <Notice tone="error">Could not load the claims.</Notice>
          </div>
        ) : (
          <Table
            rows={rows}
            rowKey={(claim) => claim.id}
            onRowClick={(claim) => navigate(`/claims/${claim.id}`)}
            empty={status || onlyMine ? 'No claims match.' : 'No claims yet.'}
            columns={[
              { key: 'number', header: 'Number', cell: (claim) => <span className="font-medium">{claim.number}</span> },
              { key: 'title', header: 'Claim', cell: (claim) => claim.title },
              ...(seesAll ? [{ key: 'claimant', header: 'Claimed by', cell: (claim: ExpenseDto) => claim.claimant?.name ?? '—' }] : []),
              { key: 'date', header: 'Latest receipt', cell: (claim) => formatDate(claim.expenseDate) },
              { key: 'total', header: 'Total', align: 'right', cell: (claim) => formatMoney(claim.total) },
              { key: 'status', header: 'Status', cell: (claim) => <StatusBadge status={claim.status} /> },
            ]}
          />
        )}
      </Card>
    </Page>
  );
}
