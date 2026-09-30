import { forwardRef, type ButtonHTMLAttributes } from 'react';

const variantTone = {
  primary: 'human',
  secondary: 'neutral',
  ghost: 'ghost',
  danger: 'breach',
} as const;

const sizes = {
  sm: 'px-2 py-1 text-[8px]',
  md: 'px-2.5 py-1.5 text-[9px]',
  lg: 'px-3 py-2 text-[10px]',
} as const;

const TONES: Record<string, string> = {
  neutral: 'border-hair bg-raised text-ink-dim',
  ghost: 'border-hair/60 bg-transparent text-ink-ghost',
  signal: 'border-signal-dim/60 bg-signal-wash text-signal',
  authored: 'border-authored-dim/60 bg-authored-wash text-authored',
  breach: 'border-breach/50 bg-breach-wash text-breach',
  human: 'border-human/40 bg-human-wash text-human',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantTone;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    const tone = variantTone[variant];
    return (
      <button
        ref={ref}
        className={`inline-flex shrink-0 items-center justify-center rounded-sm border font-mono tracked transition-colors ${
          TONES[tone]
        } disabled:cursor-not-allowed disabled:opacity-40 enabled:cursor-pointer enabled:hover:border-hair-lit ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
