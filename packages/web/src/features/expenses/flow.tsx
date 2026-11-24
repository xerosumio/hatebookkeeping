import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, formatMoney, hkToday, payInputSchema, type ExpenseAction, type ExpenseDto, type PayInput } from '@hbk/shared';
import { del, post, useSave } from '../../shared/api/hooks';
import { ConfirmDialog } from '../../shared/components/dialogs';
import { ApprovalSummary, History } from '../../shared/components/status';
import { Button, Card, DetailRow, Field, FormGrid, Input, Modal, Notice, Select } from '../../shared/components/ui';
import { useFormSave } from '../../shared/form';

/**
 * The buttons, dialogs and side panels shared by expenses, claims and salary
 * runs. They all move through the same steps, so they share one screen part.
 */

const WORD: Record<ExpenseDto['kind'], string> = { expense: 'expense', claim: 'claim', salary: 'salary run' };

function PayDialog({ base, expense, onClose }: { base: string; expense: ExpenseDto; onClose: () => void }) {
  const [paidDate, setPaidDate] = useState(hkToday());
  const [reference, setReference] = useState('');
  const build = useCallback(() => ({ paidDate, reference }), [paidDate, reference]);
  const send = useCallback((value: PayInput) => post(`${base}/${expense.id}/pay`, value), [base, expense.id]);
  const save = useFormSave(payInputSchema, build, send, onClose);
  return (
    <Modal
      title={`Mark ${expense.number} as paid`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={save.busy} onClick={() => void save.submit()}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-dim">
        {formatMoney(expense.total)} — record this after the money has left the bank. Once paid, it can no longer be changed.
      </div>
      <FormGrid>
        <Field label="Date paid" error={save.errors.paidDate}>
          <Input type="date" value={paidDate} max={hkToday()} invalid={!!save.errors.paidDate} onChange={(event) => setPaidDate(event.target.value)} />
        </Field>
        <Field label="Reference" error={save.errors.reference} hint="Bank or FPS reference">
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
      </FormGrid>
      {save.message && Object.keys(save.errors).length === 0 ? <Notice tone="error">{save.message}</Notice> : null}
    </Modal>
  );
}

type Dialog = 'reject' | 'withdraw' | 'delete' | 'pay' | 'reverse' | null;

/** The action buttons for one item, plus the dialogs they open. `extra` goes first (e.g. an Edit button). */
export function FlowActions({ base, expense, extra }: { base: string; expense: ExpenseDto; extra?: ReactNode }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);
  const path = `${base}/${expense.id}`;
  const word = WORD[expense.kind];

  const step = useSave((action: 'submit' | 'approve') => post(`${path}/${action}`));
  const reject = useSave((reason: string) => post(`${path}/reject`, { reason }), close);
  const withdraw = useSave(() => post(`${path}/withdraw`), close);
  const reverse = useSave((reason: string) => post(`${path}/reverse`, { reason }), close);
  const remove = useSave(
    () => del(path),
    () => navigate(base === '/salary/runs' ? '/salary' : base),
  );
  const has = (action: ExpenseAction) => expense.actions.includes(action);

  return (
    <>
      {extra}
      {has('delete') ? (
        <Button variant="danger" onClick={() => setDialog('delete')}>
          Delete draft
        </Button>
      ) : null}
      {has('withdraw') ? <Button onClick={() => setDialog('withdraw')}>Take back to draft</Button> : null}
      {has('reject') ? (
        <Button variant="danger" onClick={() => setDialog('reject')}>
          Reject
        </Button>
      ) : null}
      {has('submit') ? (
        <Button variant="primary" busy={step.busy} onClick={() => void step.run('submit')}>
          Submit for approval
        </Button>
      ) : null}
      {has('approve') ? (
        <Button variant="primary" busy={step.busy} onClick={() => void step.run('approve')}>
          Approve
        </Button>
      ) : null}
      {has('pay') ? (
        <Button variant="primary" onClick={() => setDialog('pay')}>
          Mark as paid
        </Button>
      ) : null}
      {has('reverse') ? (
        <Button variant="danger" onClick={() => setDialog('reverse')}>
          Reverse
        </Button>
      ) : null}
      {step.failure ? (
        <span role="alert" className="basis-full text-right text-sm text-breach">
          {step.failure.message}
        </span>
      ) : null}

      {dialog === 'pay' ? <PayDialog base={base} expense={expense} onClose={close} /> : null}
      {dialog === 'reject' ? (
        <ConfirmDialog
          title={`Reject ${expense.number}?`}
          confirmLabel="Reject"
          danger
          reason={{ label: 'What needs to change?', required: true }}
          busy={reject.busy}
          failure={reject.failure}
          onConfirm={(reason) => void reject.run(reason)}
          onClose={close}
        >
          The {word} goes back to draft and the person who entered it is told why.
        </ConfirmDialog>
      ) : null}
      {dialog === 'withdraw' ? (
        <ConfirmDialog title={`Take this ${word} back to draft?`} confirmLabel="Take back to draft" busy={withdraw.busy} failure={withdraw.failure} onConfirm={() => void withdraw.run()} onClose={close}>
          Its approvals are cleared, so it must be approved again before it can be paid.
        </ConfirmDialog>
      ) : null}
      {dialog === 'reverse' ? (
        <ConfirmDialog
          title={`Reverse ${expense.number}?`}
          confirmLabel="Reverse"
          danger
          reason={{ label: 'Why is it being reversed?', required: true }}
          busy={reverse.busy}
          failure={reverse.failure}
          onConfirm={(reason) => void reverse.run(reason)}
          onClose={close}
        >
          Use this when a paid {word} was recorded by mistake. It stays on file, marked as reversed, and no longer counts in the P&amp;L. This cannot be undone.
        </ConfirmDialog>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmDialog title="Delete this draft?" confirmLabel="Delete draft" danger busy={remove.busy} failure={remove.failure} onConfirm={() => void remove.run()} onClose={close} />
      ) : null}
    </>
  );
}

const NEXT_STEP: Partial<Record<ExpenseDto['status'], string>> = {
  draft: 'This is a draft. Submit it for approval; it cannot be paid until it is approved.',
  pending_approval: 'Waiting for approval.',
  approved: 'Approved. Pay it from the bank, then mark it as paid here.',
};

export function FlowNotices({ expense }: { expense: ExpenseDto }) {
  return (
    <>
      {expense.status === 'draft' && expense.rejectionReason ? <Notice tone="warning">Rejected: {expense.rejectionReason}</Notice> : null}
      {expense.status === 'reversed' ? <Notice tone="warning">Reversed: {expense.reversalReason}. It no longer counts in the P&amp;L.</Notice> : null}
      {NEXT_STEP[expense.status] ? <Notice tone="info">{NEXT_STEP[expense.status]}</Notice> : null}
    </>
  );
}

/** Payment, approval and history panels for the side column. */
export function FlowSide({ expense }: { expense: ExpenseDto }) {
  const waiting = expense.status === 'pending_approval';
  return (
    <>
      {expense.paidDate ? (
        <Card title="Payment">
          <DetailRow label="Paid on">{formatDate(expense.paidDate)}</DetailRow>
          <DetailRow label="Reference">{expense.paymentReference || '—'}</DetailRow>
        </Card>
      ) : null}
      <Card title="Approval">
        <ApprovalSummary approvals={expense.approvals} required={expense.approvalsRequired} />
        {waiting && !expense.actions.includes('approve') ? (
          <div className="mt-2 text-xs text-ink-faint">
            You cannot approve this: either you prepared it, it pays you, you already approved it, or you are not an approver.
          </div>
        ) : null}
      </Card>
      <History activity={expense.activity} />
    </>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-human">
      ← {children}
    </Link>
  );
}

const FILTERS = [
  ['', 'All'],
  ['open', 'Not yet paid'],
  ['draft', 'Drafts'],
  ['pending_approval', 'Waiting for approval'],
  ['approved', 'Approved, to be paid'],
  ['paid', 'Paid'],
  ['reversed', 'Reversed'],
] as const;

export function StatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select aria-label="Show" className="!w-auto" value={value} onChange={(event) => onChange(event.target.value)}>
      {FILTERS.map(([option, label]) => (
        <option key={option} value={option}>
          {label}
        </option>
      ))}
    </Select>
  );
}
