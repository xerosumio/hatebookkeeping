import { useState, type ReactNode } from 'react';
import type { ApiFailure } from '../api/client';
import { Button, Field, Modal, Notice, Textarea } from './ui';

/**
 * Asks before a change that matters. With `reason`, the person must (or may)
 * say why, and the text is passed to `onConfirm`.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger,
  reason,
  busy,
  failure,
  onConfirm,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reason?: { label: string; required: boolean };
  busy?: boolean;
  failure?: ApiFailure | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const missing = reason?.required === true && text.trim().length === 0;
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} disabled={missing} onClick={() => onConfirm(text.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ? <div className="text-sm text-ink-dim">{children}</div> : null}
      {reason ? (
        <Field label={reason.label} error={failure?.fields.reason}>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} autoFocus />
        </Field>
      ) : null}
      {failure ? <Notice tone="error">{failure.message}</Notice> : null}
    </Modal>
  );
}
