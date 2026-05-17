import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}

const base =
  'inline-flex items-center gap-1.5 font-semibold rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none';

const sizes: Record<Size, string> = {
  sm: 'text-[12px] px-2.5 h-7',
  md: 'text-[13px] px-3.5 h-9',
};

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
  outline:
    'border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]',
  ghost:
    'text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]',
  subtle:
    'bg-[var(--color-paper-2)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-3)]',
  danger:
    'bg-[var(--color-accent)] text-[var(--color-paper)] hover:opacity-90',
};

export function Button({
  variant = 'outline',
  size = 'md',
  leading,
  trailing,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {leading && <span className="-ml-0.5 flex">{leading}</span>}
      {children}
      {trailing && <span className="-mr-0.5 flex">{trailing}</span>}
    </button>
  );
}
