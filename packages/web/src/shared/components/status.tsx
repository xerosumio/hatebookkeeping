import { Tag, type Tone } from '@naton/ui';
import { formatDateTime, type ActivityDto, type ApprovalDto } from '@hbk/shared';
import { Card } from './ui';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_approval: { label: 'Waiting for approval', tone: 'signal' },
  approved: { label: 'Approved', tone: 'human' },
  sent: { label: 'Sent', tone: 'human' },
  accepted: { label: 'Accepted', tone: 'authored' },
  declined: { label: 'Declined', tone: 'breach' },
  unpaid: { label: 'Unpaid', tone: 'signal' },
  partial: { label: 'Part paid', tone: 'signal' },
  paid: { label: 'Paid', tone: 'authored' },
  cancelled: { label: 'Cancelled', tone: 'ghost' },
  reversed: { label: 'Reversed', tone: 'ghost' },
  overdue: { label: 'Overdue', tone: 'breach' },
  due: { label: 'Due', tone: 'signal' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'ghost' },
  ended: { label: 'Ended', tone: 'ghost' },
  voided: { label: 'Voided', tone: 'ghost' },
  active: { label: 'Active', tone: 'authored' },
  inactive: { label: 'Switched off', tone: 'ghost' },
  archived: { label: 'Archived', tone: 'ghost' },
};

// eslint-disable-next-line react-refresh/only-export-components
export function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Tag tone={entry.tone}>{entry.label}</Tag>;
}

export function ApprovalSummary({ approvals, required }: { approvals: ApprovalDto[]; required: number }) {
  return (
    <div className="text-sm text-ink-dim">
      <div>
        {approvals.length} of {required} approval{required === 1 ? '' : 's'}
      </div>
      {approvals.map((approval) => (
        <div key={approval.userId} className="text-xs text-ink-faint">
          {approval.userName} · {formatDateTime(approval.at)}
        </div>
      ))}
    </div>
  );
}

export function History({ activity }: { activity: ActivityDto[] }) {
  return (
    <Card title="History">
      {activity.length === 0 ? (
        <div className="text-sm text-ink-ghost">Nothing recorded yet.</div>
      ) : (
        <ol className="space-y-2.5">
          {[...activity].reverse().map((entry, index) => (
            <li key={index} className="text-sm">
              <div className="text-ink">
                {entry.action}
                <span className="text-ink-faint"> · {entry.userName}</span>
              </div>
              {entry.note ? <div className="text-xs text-ink-dim">{entry.note}</div> : null}
              <div className="text-xs text-ink-ghost">{formatDateTime(entry.at)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
