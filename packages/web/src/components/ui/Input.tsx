import { forwardRef, type InputHTMLAttributes } from 'react';

export const inputClass =
  'h-8 w-full rounded-md px-3 text-sm transition-colors focus:outline-none bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line-heavy)] placeholder:text-[var(--color-ink-faint)]';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`${inputClass} ${className}`} {...props} />
  ),
);
Input.displayName = 'Input';
