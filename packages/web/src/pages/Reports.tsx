import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClosePreview, useCloseMonth, useEntities, useMonthlyClose, useMonthPlan, useReopenMonth } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney, titleCase } from '../utils/money';
import type { Entity, MonthlyClose, MonthPlanInvoiceLine, MonthPlanReport, MonthPlanRequestLine, TakeOutReport } from '../types';

type RangeMode = 'month' | 'year' | 'custom';

const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function hkParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatHkDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-HK', { timeZone: 'Asia/Hong_Kong' });
}

export default function Reports() {
  const initial = hkParts();
  const [entityFilter, setEntityFilter] = useState('');
  const [mode, setMode] = useState<RangeMode>('month');
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [startDate, setStartDate] = useState(ymd(initial.year, initial.month, 1));
  const [endDate, setEndDate] = useState(ymd(initial.year, initial.month, lastDay(initial.year, initial.month)));
  const { data: entities } = useEntities();
  const years = Array.from({ length: 5 }, (_, i) => initial.year - i);

  const range = mode === 'year'
    ? { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
    : mode === 'custom'
      ? { startDate, endDate }
      : { startDate: ymd(year, month, 1), endDate: ymd(year, month, lastDay(year, month)) };
  const rangeValid = range.startDate <= range.endDate;
  const { data, isLoading } = useMonthPlan(
    rangeValid ? range.startDate : undefined,
    rangeValid ? range.endDate : undefined,
    entityFilter || undefined,
  );

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-normal text-ink">Reports</h1>

      <div className="mb-4 flex items-center gap-4">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-sm border border-hair bg-panel px-3 py-1 font-mono text-[10px] text-ink-dim focus:outline-none focus:ring-2 focus:ring-human"
        >
          <option value="">All Entities</option>
          {entities?.map((ent: Entity) => (
            <option key={ent._id} value={ent._id}>{ent.code} — {ent.name}</option>
          ))}
        </select>
      </div>

      <div className="max-w-5xl">
        <div className="flex flex-wrap items-end gap-4 mb-2">
          <div className="flex overflow-hidden rounded-sm border border-hair">
            {([
              ['month', 'Month'],
              ['year', 'Year'],
              ['custom', 'Custom'],
            ] as const).map(([value, label], index) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`px-3 py-1.5 font-mono text-[9px] tracked transition-colors ${
                  mode === value ? 'bg-human text-white' : 'bg-panel text-ink-dim hover:bg-raised'
                } ${index > 0 ? 'border-l border-hair' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'month' && (
            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                {monthNames.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {mode === 'year' && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {mode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Income follows invoice date. Expenses follow bill due date. A bill with no due date uses the day it was created.
        </p>

        {!rangeValid ? (
          <p className="text-sm text-red-600">End date must be on or after the start date.</p>
        ) : isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-3">Pending in</div>
                <PeriodLines rows={[
                  ['Total', formatMoney(data.incoming.billed), 'text-gray-900'],
                  ['Received', formatMoney(data.incoming.collected), 'text-green-700'],
                  ['Pending', formatMoney(data.incoming.pending), 'text-amber-700'],
                ]} />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-3">Pending out</div>
                <PeriodLines rows={[
                  ['Total', formatMoney(data.outgoing.committed), 'text-gray-900'],
                  ['Paid', formatMoney(data.outgoing.paid), 'text-green-700'],
                  ['Pending', formatMoney(data.outgoing.pending), 'text-red-700'],
                ]} />
              </div>
            </div>

            {mode === 'month' && (
              <MonthClosePanel entity={entityFilter} year={year} month={month} />
            )}

            <TakeOut takeOut={data.takeOut} />

            <ProfitAndLoss pl={data.pl} />

            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">In this period</h2>
              {data.incoming.items.length > 0 ? (
                <MonthPlanInvoiceTable rows={data.incoming.items} showCollected />
              ) : (
                <p className="text-gray-500 text-sm">No invoices dated in this period.</p>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Out this period</h2>
              {data.outgoing.items.length > 0 ? (
                <MonthPlanRequestTable rows={data.outgoing.items} showSettled />
              ) : (
                <p className="text-gray-500 text-sm">No bills due in this period.</p>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Older, still unpaid</h2>
              <p className="text-xs text-gray-400 mb-3">
                Receivable {formatMoney(data.carryover.receivable.total)} · Payable {formatMoney(data.carryover.payable.total)}
              </p>
              <div className="space-y-4">
                {data.carryover.receivable.items.length > 0 ? (
                  <MonthPlanInvoiceTable rows={data.carryover.receivable.items} />
                ) : (
                  <p className="text-gray-500 text-sm">No older unpaid invoices.</p>
                )}
                {data.carryover.payable.items.length > 0 ? (
                  <MonthPlanRequestTable rows={data.carryover.payable.items} />
                ) : (
                  <p className="text-gray-500 text-sm">No older open payment requests.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TakeOut({ takeOut }: { takeOut: TakeOutReport }) {
  const leftClass = takeOut.available > 0 ? 'text-green-700' : 'text-red-700';
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Take out</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <PeriodLines rows={[
          ['Operating balance', formatMoney(takeOut.operatingCash), 'text-gray-900'],
          ['Still to pay from the bank', formatMoney(takeOut.pendingOut), 'text-red-700'],
          ['Left to take out', formatMoney(takeOut.available), leftClass],
        ]} />
        {takeOut.available < 0 ? (
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm text-red-700">
              Do not take money out. Short by {formatMoney(-takeOut.available)}.
            </p>
            {takeOut.shareholders.map((person, index) => (
              <SplitLine
                key={`owe-${index}`}
                label={`${person.name} ${person.sharePercent.toFixed(2)}% needs to pay`}
                amount={person.amount}
              />
            ))}
            {takeOut.unassignedShareholderPool > 0 && (
              <SplitLine label="Unassigned shortfall" amount={takeOut.unassignedShareholderPool} />
            )}
          </div>
        ) : takeOut.available === 0 ? (
          <p className="mt-3 text-sm text-red-700">Do not take money out.</p>
        ) : (
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
            {takeOut.bonus.map((person, index) => (
              <SplitLine
                key={`bonus-${index}`}
                label={`${person.name} bonus ${person.percent.toFixed(2)}%`}
                amount={person.amount}
              />
            ))}
            {takeOut.bonusExceedsCash && (
              <p className="text-sm text-amber-700">
                Bonus shares are larger than the cash left. Reserves and shareholder payouts are zero.
              </p>
            )}
            <SplitLine label="Staff reserve (5%)" amount={takeOut.staffReserve} />
            <SplitLine label="Company reserve (30% of the rest)" amount={takeOut.companyReserve} />
            {takeOut.shareholders.map((person, index) => (
              <SplitLine
                key={`share-${index}`}
                label={`${person.name} ${person.sharePercent.toFixed(2)}%`}
                amount={person.amount}
              />
            ))}
            {takeOut.unassignedShareholderPool > 0 && (
              <SplitLine label="Unassigned shareholder pool" amount={takeOut.unassignedShareholderPool} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function apiError(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return message || fallback;
}

function nameOf(value: unknown): string {
  return value && typeof value === 'object' && 'name' in value ? String((value as { name: unknown }).name) : '';
}

function MonthClosePanel({ entity, year, month }: { entity: string; year: number; month: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: close, isLoading } = useMonthlyClose(entity || undefined, year, month);
  const reopen = useReopenMonth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const label = `${monthNames[month]} ${year}`;

  if (!entity) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-500">Pick one entity to close {label}.</span>
        {isAdmin && (
          <button
            type="button"
            disabled
            title="Closing works on one entity at a time"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white opacity-40"
          >
            Close month
          </button>
        )}
      </div>
    );
  }

  if (isLoading) return null;

  if (close) {
    return (
      <ClosedMonthSummary
        close={close}
        label={label}
        canReopen={isAdmin}
        reopening={reopen.isPending}
        onReopen={async () => {
          if (!close._id) return;
          if (!confirm(`Reopen ${label}? This removes the reserve entries and deletes the pending payout request.`)) return;
          try {
            await reopen.mutateAsync(close._id);
          } catch (err) {
            alert(apiError(err, 'Could not reopen this month'));
          }
        }}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-500">{label} is open.</span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Close month
          </button>
        )}
      </div>
      {dialogOpen && (
        <CloseMonthDialog entity={entity} year={year} month={month} label={label} onClose={() => setDialogOpen(false)} />
      )}
    </>
  );
}

function ClosedMonthSummary({
  close, label, canReopen, reopening, onReopen,
}: {
  close: MonthlyClose;
  label: string;
  canReopen: boolean;
  reopening: boolean;
  onReopen: () => void;
}) {
  const request = typeof close.paymentRequest === 'object' ? close.paymentRequest : null;
  const closedBy = nameOf(close.closedBy);
  const payouts = [
    ...(close.bonusDistributions || []).map((line) => ({ label: `${line.name} bonus ${line.percent.toFixed(2)}%`, amount: line.amount })),
    ...close.distributions.map((line) => ({
      label: `${nameOf(line.shareholder) || 'Shareholder'} ${line.sharePercent.toFixed(2)}%`,
      amount: line.amount,
    })),
  ];
  return (
    <section className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-green-800">{label} closed</div>
          <div className="text-xs text-green-700">
            {close.closedAt ? `Closed on ${formatHkDate(close.closedAt)}` : 'Closed'}
            {closedBy ? ` by ${closedBy}` : ''}
          </div>
        </div>
        {canReopen && (
          <button
            type="button"
            onClick={onReopen}
            disabled={reopening}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {reopening ? 'Reopening...' : 'Reopen'}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2 border-t border-green-200 pt-3">
        {close.takeOut && <SplitLine label="Left to take out at close" amount={close.takeOut.available} />}
        {close.staffReserve > 0 && (
          <SplitLine label={`Staff reserve${nameOf(close.staffReserveFund) ? ` to ${nameOf(close.staffReserveFund)}` : ''}`} amount={close.staffReserve} />
        )}
        {close.companyReserve > 0 && (
          <SplitLine label={`Company reserve${nameOf(close.companyReserveFund) ? ` to ${nameOf(close.companyReserveFund)}` : ''}`} amount={close.companyReserve} />
        )}
        {payouts.map((line, index) => (
          <SplitLine key={`payout-${index}`} label={line.label} amount={line.amount} />
        ))}
        {request && (
          <p className="text-sm text-gray-600">
            Payouts:{' '}
            <Link to={`/payment-requests/${request._id}`} className="font-medium text-blue-600 hover:underline">
              {request.requestNumber}
            </Link>{' '}
            ({titleCase(request.status)})
          </p>
        )}
        {close.isLoss && (
          <p className="text-sm text-red-700">Short this month. Nothing was distributed.</p>
        )}
        {close.notes && <p className="text-xs text-gray-500">{close.notes}</p>}
      </div>
    </section>
  );
}

function CloseMonthDialog({
  entity, year, month, label, onClose,
}: {
  entity: string;
  year: number;
  month: number;
  label: string;
  onClose: () => void;
}) {
  const { data: preview, isLoading } = useClosePreview(entity, year, month);
  const closeMonth = useCloseMonth();
  const [reserveHeldIn, setReserveHeldIn] = useState('');
  const [sourceBankAccount, setSourceBankAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!preview?.defaultBankFund) return;
    setReserveHeldIn((current) => current || preview.defaultBankFund!);
    setSourceBankAccount((current) => current || preview.defaultBankFund!);
  }, [preview?.defaultBankFund]);

  const takeOut = preview?.takeOut;
  const distributing = takeOut?.direction === 'take_out';
  const hasReserves = Boolean(takeOut && (takeOut.staffReserve > 0 || takeOut.companyReserve > 0));
  const hasPayouts = Boolean(takeOut && [...takeOut.bonus, ...takeOut.shareholders].some((line) => line.amount > 0));
  const bankFunds = preview?.bankFunds.filter((fund) => fund.type === 'bank') ?? [];
  const blocked = (preview?.missingPayees.length ?? 0) > 0
    || (hasReserves && !reserveHeldIn)
    || (hasPayouts && !sourceBankAccount);

  async function handleConfirm() {
    setError('');
    try {
      await closeMonth.mutateAsync({ entity, year, month, reserveHeldIn, sourceBankAccount, notes });
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not close this month'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[85vh] w-[520px] overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-1 text-lg font-bold">Close {label}</h3>
        <p className="mb-4 text-xs text-gray-500">
          Uses today's operating balance. Reserves are earmarked inside the bank account you choose. Bonus and shareholder payouts become one pending payment request.
        </p>

        {isLoading || !takeOut ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded border border-gray-200 p-3">
              <SplitLine label="Left to take out" amount={takeOut.available} />
              {distributing ? (
                <>
                  {takeOut.bonus.map((line, index) => (
                    <SplitLine key={`b-${index}`} label={`${line.name} bonus ${line.percent.toFixed(2)}%`} amount={line.amount} />
                  ))}
                  <SplitLine label="Staff reserve (5%)" amount={takeOut.staffReserve} />
                  <SplitLine label="Company reserve (30% of the rest)" amount={takeOut.companyReserve} />
                  {takeOut.shareholders.map((line, index) => (
                    <SplitLine key={`s-${index}`} label={`${line.name} ${line.sharePercent.toFixed(2)}%`} amount={line.amount} />
                  ))}
                </>
              ) : (
                <p className="text-sm text-red-700">
                  Nothing to distribute. Closing only records the month.
                </p>
              )}
            </div>

            {preview.missingPayees.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Set a payee on the{' '}
                <Link to="/shareholders" className="font-medium underline">Shareholders page</Link>{' '}
                for: {preview.missingPayees.map((person) => person.name).join(', ')}
              </div>
            )}

            {hasReserves && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hold reserves in</label>
                <select
                  value={reserveHeldIn}
                  onChange={(e) => setReserveHeldIn(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a fund...</option>
                  {preview.bankFunds.map((fund) => (
                    <option key={fund._id} value={fund._id}>{fund.name} ({formatMoney(fund.balance)})</option>
                  ))}
                </select>
              </div>
            )}

            {hasPayouts && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Pay out from</label>
                <select
                  value={sourceBankAccount}
                  onChange={(e) => setSourceBankAccount(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a bank fund...</option>
                  {bankFunds.map((fund) => (
                    <option key={fund._id} value={fund._id}>{fund.name} ({formatMoney(fund.balance)})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !takeOut || blocked || closeMonth.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {closeMonth.isPending ? 'Closing...' : `Close ${label}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SplitLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-mono text-sm font-semibold text-gray-900">{formatMoney(amount)}</span>
    </div>
  );
}

function ProfitAndLoss({ pl }: { pl: MonthPlanReport['pl'] }) {
  const net = pl.totals.net;
  const status = net > 0 ? 'Profit' : net < 0 ? 'Loss' : 'Even';
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Profit and loss</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Income</div>
            <div className="text-xl font-bold font-mono text-green-700">{formatMoney(pl.totals.income)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Expenses</div>
            <div className="text-xl font-bold font-mono text-red-700">{formatMoney(pl.totals.expense)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">{status}</div>
            <div className={`text-xl font-bold font-mono ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatMoney(net)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CategoryList title="Income" rows={pl.income} amountClass="text-green-700" empty="No invoices dated in this period." />
          <CategoryList title="Expenses" rows={pl.expenses} amountClass="text-red-700" empty="No bills due in this period." />
        </div>
      </div>
    </section>
  );
}

function CategoryList({
  title,
  rows,
  amountClass,
  empty,
}: {
  title: string;
  rows: MonthPlanReport['pl']['income'];
  amountClass: string;
  empty: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 text-sm font-medium text-gray-600 border-b border-gray-200 bg-gray-50">{title}</div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2 text-gray-700">{titleCase(row.category)}</td>
                <td className={`px-4 py-2 text-right font-mono ${amountClass}`}>{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PeriodLines({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="space-y-2">
      {rows.map(([label, amount, color]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-gray-500">{label}</span>
          <span className={`font-mono text-lg font-semibold ${color}`}>{amount}</span>
        </div>
      ))}
    </div>
  );
}

function MonthPlanInvoiceTable({ rows, showCollected = false }: { rows: MonthPlanInvoiceLine[]; showCollected?: boolean }) {
  const dueTotal = rows.reduce((sum, row) => sum + row.amountDue, 0);
  const collectedTotal = rows.reduce((sum, row) => sum + row.amountPaid, 0);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice date</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
            {showCollected && <th className="text-right px-4 py-3 font-medium text-gray-600">Collected</th>}
            <th className="text-right px-4 py-3 font-medium text-gray-600">Still due</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link to={`/invoices/${row.id}`} className="text-blue-600 hover:underline font-medium">
                  {row.invoiceNumber}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">{row.clientName || 'N/A'}</td>
              <td className="px-4 py-3 text-gray-500">{formatHkDate(row.invoiceDate)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatMoney(row.total)}</td>
              {showCollected && <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(row.amountPaid)}</td>}
              <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(row.amountDue)}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  row.status === 'paid' ? 'bg-green-100 text-green-700' : row.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {titleCase(row.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr className="font-bold">
            <td className="px-4 py-3" colSpan={3}>Total</td>
            <td className="px-4 py-3 text-right font-mono">{formatMoney(rows.reduce((sum, row) => sum + row.total, 0))}</td>
            {showCollected && <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(collectedTotal)}</td>}
            <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(dueTotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MonthPlanRequestTable({ rows, showSettled = false }: { rows: MonthPlanRequestLine[]; showSettled?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Request</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Payee</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
            {showSettled && <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>}
            {showSettled && <th className="text-right px-4 py-3 font-medium text-gray-600">Still to pay</th>}
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const paid = row.status === 'executed' ? row.amount : 0;
            const open = row.status === 'executed' ? 0 : row.amount;
            return (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/payment-requests/${row.id}`} className="text-blue-600 hover:underline font-medium">
                    {row.requestNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{row.description}</td>
                <td className="px-4 py-3 text-gray-600">{row.payeeNames.join(', ') || 'N/A'}</td>
                <td className="px-4 py-3 text-gray-500">{formatHkDate(row.dueDate)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(row.amount)}</td>
                {showSettled && <td className="px-4 py-3 text-right font-mono text-green-600">{formatMoney(paid)}</td>}
                {showSettled && <td className="px-4 py-3 text-right font-mono text-red-600">{formatMoney(open)}</td>}
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.status === 'executed' ? 'bg-green-100 text-green-700' : row.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {titleCase(row.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr className="font-bold">
            <td className="px-4 py-3" colSpan={4}>Total</td>
            <td className="px-4 py-3 text-right font-mono">{formatMoney(rows.reduce((sum, row) => sum + row.amount, 0))}</td>
            {showSettled && (
              <td className="px-4 py-3 text-right font-mono text-green-600">
                {formatMoney(rows.reduce((sum, row) => sum + (row.status === 'executed' ? row.amount : 0), 0))}
              </td>
            )}
            {showSettled && (
              <td className="px-4 py-3 text-right font-mono text-red-600">
                {formatMoney(rows.reduce((sum, row) => sum + (row.status === 'executed' ? 0 : row.amount), 0))}
              </td>
            )}
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
