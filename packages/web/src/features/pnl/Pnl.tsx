import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PNL_BASIS_LABELS,
  addMonthsToMonth,
  formatDate,
  formatMoney,
  hkCurrentMonth,
  isValidMonth,
  monthLabel,
  shortMonthLabel,
  type PnlBasis,
  type PnlEntryDto,
  type PnlMonthDto,
  type PnlTotalsDto,
  type PnlYearDto,
} from '@hbk/shared';
import { useGet } from '../../shared/api/hooks';
import { useCompanies } from '../../shared/company';
import { Button, Card, Input, Loading, Modal, Notice, Page, Table } from '../../shared/components/ui';

const BASES: PnlBasis[] = ['cash', 'billed'];

const BASIS_NOTE: Record<PnlBasis, string> = {
  cash: 'Money that actually moved: payments received on the day they arrived, and expenses, claims and salary on the day they were paid.',
  billed:
    'What was invoiced and agreed to: invoices on their invoice date (not drafts or cancelled ones), and expenses, claims and salary once approved, on the date of the bill, receipt or salary month.',
};

type Side = 'income' | 'expense';

/** Where the record behind a P&L item lives. */
function entryLink(entry: PnlEntryDto): string {
  switch (entry.source) {
    case 'invoice':
    case 'payment':
      return `/invoices/${entry.documentId}`;
    case 'expense':
      return `/expenses/${entry.documentId}`;
    case 'claim':
      return `/claims/${entry.documentId}`;
    case 'salary':
      return `/salary/runs/${entry.documentId}`;
    case 'other_income':
      return '/other-income';
  }
}

const SOURCE_LABEL: Record<PnlEntryDto['source'], string> = {
  invoice: 'Invoice',
  payment: 'Payment received',
  expense: 'Expense',
  claim: 'Claim',
  salary: 'Salary',
  other_income: 'Other income',
};

interface Drill {
  basis: PnlBasis;
  side: Side;
  categoryId: string | null;
  label: string;
  amount: number;
}

function EntriesDialog({ month, companyId, drill, onClose }: { month: string; companyId: string; drill: Drill; onClose: () => void }) {
  const entries = useGet<PnlEntryDto[]>('/reports/pnl/entries', { month, companyId, basis: drill.basis, side: drill.side, categoryId: drill.categoryId });
  return (
    <Modal title={`${drill.label} · ${monthLabel(month)}`} onClose={onClose} wide footer={<Button onClick={onClose}>Close</Button>}>
      <div className="text-sm text-ink-dim">
        {PNL_BASIS_LABELS[drill.basis]} · {formatMoney(drill.amount)}
      </div>
      {entries.isPending ? (
        <Loading />
      ) : entries.isError ? (
        <Notice tone="error">Could not load the items.</Notice>
      ) : (
        <div className="-mx-5">
          <Table
            rows={entries.data.map((entry, index) => ({ ...entry, index }))}
            rowKey={(entry) => String(entry.index)}
            empty="Nothing counted here."
            columns={[
              { key: 'date', header: 'Date', cell: (entry) => <span className="whitespace-nowrap">{formatDate(entry.date)}</span> },
              {
                key: 'what',
                header: 'Item',
                cell: (entry) => (
                  <div>
                    <Link to={entryLink(entry)} className="text-human underline">
                      {entry.number || SOURCE_LABEL[entry.source]}
                    </Link>
                    <span className="text-ink-faint"> · {SOURCE_LABEL[entry.source]}</span>
                    <div className="text-xs text-ink-dim">
                      {[entry.counterparty, entry.description].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ),
              },
              { key: 'amount', header: 'Amount', align: 'right', cell: (entry) => formatMoney(entry.amount) },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

function Figure({ amount, onOpen, strong }: { amount: number | undefined; onOpen?: () => void; strong?: boolean }) {
  if (amount === undefined) return <span className="text-ink-ghost">—</span>;
  const text = <span className={strong ? 'font-semibold' : ''}>{formatMoney(amount)}</span>;
  if (!onOpen || amount === 0) return text;
  return (
    <button type="button" onClick={onOpen} className="rounded tabular-nums text-human underline decoration-dotted underline-offset-4 hover:decoration-solid" title="Show the items behind this figure">
      {text}
    </button>
  );
}

const netClass = (amount: number) => (amount < 0 ? 'text-breach' : 'text-ink');

function MonthView({ month, companyId }: { month: string; companyId: string }) {
  const pnl = useGet<PnlMonthDto>('/reports/pnl', { month, companyId });
  const [drill, setDrill] = useState<Drill | null>(null);

  if (pnl.isPending) return <Loading />;
  if (!pnl.data) return <Notice tone="error">Could not load the P&amp;L.</Notice>;
  const data = pnl.data;

  /** Every category that has a figure on either basis, in the order the server lists them. */
  const rowsOf = (pick: (side: PnlMonthDto['cash']) => PnlMonthDto['cash']['income']) => {
    const seen = new Map<string, string>();
    for (const basis of BASES) for (const line of pick(data[basis])) seen.set(line.categoryId, line.name);
    return [...seen.entries()].map(([categoryId, name]) => ({
      categoryId,
      name,
      cash: pick(data.cash).find((line) => line.categoryId === categoryId)?.amount,
      billed: pick(data.billed).find((line) => line.categoryId === categoryId)?.amount,
    }));
  };
  const income = rowsOf((side) => side.income);
  const expenses = rowsOf((side) => side.expenses);
  const open = (basis: PnlBasis, side: Side, categoryId: string | null, label: string, amount: number) => () => setDrill({ basis, side, categoryId, label, amount });

  const section = (title: string, side: Side, rows: typeof income, totalLabel: string, total: (basis: PnlBasis) => number) => (
    <>
      <tr className="border-b border-hair bg-raised/50">
        <th colSpan={3} className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-ink-faint">
          {title}
        </th>
      </tr>
      {rows.length === 0 ? (
        <tr className="border-b border-hair/60">
          <td colSpan={3} className="px-4 py-2.5 text-ink-ghost">
            Nothing this month.
          </td>
        </tr>
      ) : (
        rows.map((row) => (
          <tr key={row.categoryId} className="border-b border-hair/60">
            <td className="px-4 py-2.5">{row.name}</td>
            {BASES.map((basis) => (
              <td key={basis} className="px-4 py-2.5 text-right tabular-nums">
                <Figure amount={row[basis]} onOpen={row[basis] === undefined ? undefined : open(basis, side, row.categoryId, row.name, row[basis])} />
              </td>
            ))}
          </tr>
        ))
      )}
      <tr className="border-b border-hair">
        <td className="px-4 py-2.5 font-medium">{totalLabel}</td>
        {BASES.map((basis) => (
          <td key={basis} className="px-4 py-2.5 text-right tabular-nums">
            <Figure amount={total(basis)} strong onOpen={open(basis, side, null, totalLabel, total(basis))} />
          </td>
        ))}
      </tr>
    </>
  );

  return (
    <>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm text-ink">
            <thead>
              <tr className="border-b border-hair text-xs text-ink-faint">
                <th className="px-4 py-3 text-left font-medium">{monthLabel(month)}</th>
                {BASES.map((basis) => (
                  <th key={basis} className="w-48 px-4 py-3 text-right font-semibold text-ink">
                    {PNL_BASIS_LABELS[basis]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section('Income', 'income', income, 'Total income', (basis) => data[basis].totalIncome)}
              {section('Expenses', 'expense', expenses, 'Total expenses', (basis) => data[basis].totalExpenses)}
              <tr>
                <td className="px-4 py-3 font-semibold">Profit or loss</td>
                {BASES.map((basis) => (
                  <td key={basis} className={`px-4 py-3 text-right text-base font-semibold tabular-nums ${netClass(data[basis].net)}`}>
                    {formatMoney(data[basis].net)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-3 text-xs text-ink-faint md:grid-cols-2">
        {BASES.map((basis) => (
          <div key={basis}>
            <span className="font-semibold text-ink-dim">{PNL_BASIS_LABELS[basis]}:</span> {BASIS_NOTE[basis]}
          </div>
        ))}
      </div>
      <div className="text-xs text-ink-faint">Months follow Hong Kong time. Click a figure to see the items behind it.</div>
      {drill ? <EntriesDialog month={month} companyId={companyId} drill={drill} onClose={() => setDrill(null)} /> : null}
    </>
  );
}

function YearView({ year, companyId, onMonth }: { year: number; companyId: string; onMonth: (month: string) => void }) {
  const pnl = useGet<PnlYearDto>('/reports/pnl/year', { year, companyId });
  if (pnl.isPending) return <Loading />;
  if (!pnl.data) return <Notice tone="error">Could not load the P&amp;L.</Notice>;
  const data = pnl.data;
  const cells = (totals: PnlTotalsDto, strong = false) =>
    (['income', 'expenses', 'net'] as const).map((key) => (
      <td key={key} className={`px-3 py-2.5 text-right tabular-nums ${strong ? 'font-semibold' : ''} ${key === 'net' ? netClass(totals.net) : ''} ${key === 'income' ? 'border-l border-hair' : ''}`}>
        {formatMoney(totals[key])}
      </td>
    ));

  return (
    <>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm text-ink">
            <thead>
              <tr className="border-b border-hair text-xs">
                <th className="px-3 py-2.5 text-left font-medium text-ink-faint">{year}</th>
                {BASES.map((basis) => (
                  <th key={basis} colSpan={3} className="border-l border-hair px-3 py-2.5 text-center font-semibold">
                    {PNL_BASIS_LABELS[basis]}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-hair text-xs text-ink-faint">
                <th />
                {BASES.map((basis) =>
                  (basis === 'cash' ? ['In', 'Out', 'Net'] : ['Billed', 'Committed', 'Net']).map((label, index) => (
                    <th key={`${basis}-${label}`} className={`px-3 py-2 text-right font-medium ${index === 0 ? 'border-l border-hair' : ''}`}>
                      {label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {data.months.map((row) => (
                <tr key={row.month} className="cursor-pointer border-b border-hair/60 hover:bg-raised" onClick={() => onMonth(row.month)}>
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-human underline decoration-dotted underline-offset-4" onClick={() => onMonth(row.month)}>
                      {shortMonthLabel(row.month)}
                    </button>
                  </td>
                  {cells(row.cash)}
                  {cells(row.billed)}
                </tr>
              ))}
              <tr className="border-t border-hair">
                <td className="px-3 py-3 font-semibold">Year</td>
                {cells(data.cash, true)}
                {cells(data.billed, true)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <div className="text-xs text-ink-faint">Click a month to see it by category.</div>
    </>
  );
}

export default function Pnl() {
  const { selectedId } = useCompanies();
  const [params, setParams] = useSearchParams();
  const current = hkCurrentMonth();
  const yearParam = Number(params.get('year'));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : null;
  const monthParam = params.get('month') ?? '';
  const month = isValidMonth(monthParam) ? monthParam : current;

  const showMonth = (value: string) => setParams({ month: value });
  const showYear = (value: number) => setParams({ year: String(value) });

  return (
    <Page
      title="Profit & loss"
      subtitle={year ? `${year}, month by month` : monthLabel(month)}
      actions={
        <>
          <div className="inline-flex overflow-hidden rounded-md border border-hair-lit">
            <button type="button" className={`px-3 py-1.5 text-sm ${year ? 'bg-panel text-ink-dim' : 'bg-human text-white'}`} onClick={() => showMonth(month)}>
              Month
            </button>
            <button type="button" className={`px-3 py-1.5 text-sm ${year ? 'bg-human text-white' : 'bg-panel text-ink-dim'}`} onClick={() => showYear(Number(month.slice(0, 4)))}>
              Year
            </button>
          </div>
          {year ? (
            <>
              <Button aria-label="Previous year" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => showYear(year - 1)} />
              <span className="min-w-12 text-center text-sm font-medium tabular-nums">{year}</span>
              <Button aria-label="Next year" icon={<ChevronRight className="h-4 w-4" />} onClick={() => showYear(year + 1)} />
            </>
          ) : (
            <>
              <Button aria-label="Previous month" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => showMonth(addMonthsToMonth(month, -1))} />
              <Input type="month" aria-label="Month" className="!w-auto" value={month} onChange={(event) => isValidMonth(event.target.value) && showMonth(event.target.value)} />
              <Button aria-label="Next month" icon={<ChevronRight className="h-4 w-4" />} onClick={() => showMonth(addMonthsToMonth(month, 1))} />
              {month !== current ? <Button onClick={() => showMonth(current)}>This month</Button> : null}
            </>
          )}
        </>
      }
    >
      {year ? <YearView year={year} companyId={selectedId} onMonth={showMonth} /> : <MonthView month={month} companyId={selectedId} />}
    </Page>
  );
}
