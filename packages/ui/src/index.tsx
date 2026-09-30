import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'signal' | 'authored' | 'breach' | 'human' | 'ghost';

const TONES: Record<Tone, string> = {
  neutral: 'border-hair bg-raised text-ink-dim',
  ghost: 'border-hair/60 bg-transparent text-ink-ghost',
  signal: 'border-signal-dim/60 bg-signal-wash text-signal',
  authored: 'border-authored-dim/60 bg-authored-wash text-authored',
  breach: 'border-breach/50 bg-breach-wash text-breach',
  human: 'border-human/40 bg-human-wash text-human',
};

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[9px] tracked text-ink-faint ${className}`}>{children}</span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Exclude<Tone, 'ghost'>;
}) {
  const tones: Record<Exclude<Tone, 'ghost'>, string> = {
    neutral: 'border-hair text-ink-dim bg-raised',
    signal: 'border-signal-dim/50 text-signal bg-signal-wash',
    authored: 'border-authored bg-authored-fill font-medium text-ink',
    breach: 'border-breach/40 text-breach bg-breach-wash',
    human: 'border-human/35 text-human bg-human-wash',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-[2px] font-mono text-[9px] tracked ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Rule({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Label>{children}</Label>
      <div className="h-px flex-1 bg-hair" />
    </div>
  );
}

export function Frame({
  glyph,
  title,
  path,
  right,
  children,
}: {
  glyph: string;
  title: string;
  path?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-hair bg-panel lift">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-hair bg-panel px-3.5 py-2.5">
        <span className="rounded-sm border border-hair bg-raised px-1.5 py-[3px] font-mono text-[9px] tracked text-ink-dim">
          {glyph}
        </span>
        <span className="font-mono text-[11px] font-medium text-ink">{title}</span>
        {path ? (
          <span className="hidden font-mono text-[9px] text-ink-ghost xl:inline">{path}</span>
        ) : null}
        {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Head({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="shrink-0 font-mono text-[9px] tracked text-ink-faint">{children}</span>
      <div className="h-px flex-1 bg-hair" />
      {right ? <span className="shrink-0 font-mono text-[9px] text-ink-ghost">{right}</span> : null}
    </div>
  );
}

export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-[2px] font-mono text-[9px] tracked ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function KV({ k, v, ink }: { k: string; v: ReactNode; ink?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hair/60 py-[5px] last:border-0">
      <span className="font-mono text-[9px] tracked text-ink-ghost">{k}</span>
      <span className="text-right font-mono text-[10px]" style={{ color: ink ?? 'var(--color-ink-dim)' }}>
        {v}
      </span>
    </div>
  );
}

export function Stat({
  n,
  label,
  ink = 'var(--color-ink)',
  sub,
}: {
  n: ReactNode;
  label: string;
  ink?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-sm border border-hair bg-raised px-3 py-2.5">
      <div className="font-mono text-[19px] leading-none tabular-nums" style={{ color: ink }}>
        {n}
      </div>
      <div className="mt-1.5 font-mono text-[9px] tracked text-ink-faint">{label}</div>
      {sub ? <div className="mt-0.5 font-mono text-[9px] text-ink-ghost">{sub}</div> : null}
    </div>
  );
}

export function NatonButton({
  children,
  onClick,
  tone = 'neutral',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-sm border px-2.5 py-1.5 font-mono text-[9px] tracked transition-colors ${
        TONES[tone]
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-hair-lit'} ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p className="max-w-[24ch] font-sans text-[12px] leading-relaxed text-ink-ghost">{children}</p>
    </div>
  );
}

export function Spark({
  series,
  tint: ink = 'var(--color-signal)',
  height = 34,
}: {
  series: number[];
  tint?: string;
  height?: number;
}) {
  const max = Math.max(1, ...series);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {series.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            height: `${Math.max(2, (v / max) * height)}px`,
            background: i === series.length - 1 ? ink : `color-mix(in srgb, ${ink} 45%, transparent)`,
          }}
        />
      ))}
    </div>
  );
}

export function formatMoney(hkd: number) {
  return `HK$${hkd.toLocaleString('en-HK', {
    minimumFractionDigits: hkd < 100 ? 2 : 0,
    maximumFractionDigits: hkd < 100 ? 2 : 0,
  })}`;
}
