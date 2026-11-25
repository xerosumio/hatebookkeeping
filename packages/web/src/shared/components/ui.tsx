import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ── Buttons ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-human bg-human text-white hover:opacity-90',
  secondary: 'border-hair-lit bg-panel text-ink hover:bg-raised',
  danger: 'border-breach/50 bg-breach-wash text-breach hover:border-breach',
  ghost: 'border-transparent bg-transparent text-ink-dim hover:bg-raised',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  busy?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', busy, icon, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium transition-colors',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANTS[variant],
        (disabled || busy) && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Form fields ────────────────────────────────────────────────────────────

const CONTROL =
  'w-full rounded-md border bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-ghost disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-faint';

const controlClass = (invalid?: boolean, extra?: string) => cx(CONTROL, invalid ? 'border-breach' : 'border-hair-lit', extra);

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      {label ? <span className="mb-1 block text-xs font-medium text-ink-dim">{label}</span> : null}
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-breach">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-ghost">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={controlClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ invalid, className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea rows={rows} className={controlClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={controlClass(invalid, className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2 text-sm text-ink', disabled && 'opacity-50')}>
      <input type="checkbox" className="h-4 w-4" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

/** A money field. The value is the text the person typed; the form turns it into cents on save. */
export function MoneyInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-ghost">HK$</span>
      <input inputMode="decimal" placeholder="0.00" className={controlClass(invalid, cx('pl-11 text-right tabular-nums', className))} aria-invalid={invalid || undefined} {...rest} />
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────

export function Page({
  title,
  subtitle,
  actions,
  back,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
      {back ? <div className="mb-2 text-xs">{back}</div> : null}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {subtitle ? <div className="mt-1 text-sm text-ink-faint">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function Card({ title, right, children, padded = true, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; padded?: boolean; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-hair bg-panel', className)}>
      {title || right ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
        </div>
      ) : null}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'Nothing here yet.',
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
}) {
  if (rows.length === 0) return <div className="px-4 py-10 text-center text-sm text-ink-ghost">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hair text-xs text-ink-faint">
            {columns.map((column) => (
              <th key={column.key} className={cx('whitespace-nowrap px-4 py-2.5 font-medium', column.align === 'right' ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx('border-b border-hair/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-raised')}
            >
              {columns.map((column) => (
                <td key={column.key} className={cx('px-4 py-2.5 align-middle text-ink', column.align === 'right' && 'text-right tabular-nums', column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('w-full rounded-lg border border-hair bg-panel lift-focus', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-hair px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-ink-ghost hover:bg-raised">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-hair px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

// ── Feedback ───────────────────────────────────────────────────────────────

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const tones = {
    info: 'border-human/30 bg-human-wash text-human',
    error: 'border-breach/40 bg-breach-wash text-breach',
    success: 'border-authored-dim/50 bg-authored-wash text-authored',
    warning: 'border-signal-dim/50 bg-signal-wash text-signal',
  } as const;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-md border px-3.5 py-2.5 text-sm', tones[tone])}>
      {children}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-ink-ghost">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hair/60 py-2 text-sm last:border-0">
      <span className="shrink-0 text-ink-faint">{label}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}

export function FormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={cx('grid gap-4', columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>{children}</div>;
}
