import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  padded = true,
  bordered = true,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  bordered?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-[var(--color-card)] rounded-[4px]',
        bordered && 'border border-[var(--color-rule)]',
        padded && 'p-6',
        hover && 'lift',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      <header className="flex items-baseline justify-between gap-3 flex-wrap px-6 pt-5 pb-4 border-b border-[var(--color-rule-soft)]">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h3 className="font-display text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
            {title}
          </h3>
        </div>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-6 border border-dashed border-[var(--color-rule)] rounded-[4px] bg-[var(--color-paper)]/40">
      <div className="font-display text-[18px] text-[var(--color-ink-2)] font-semibold">{title}</div>
      {hint && (
        <p className="mt-1.5 text-[13px] text-[var(--color-ink-3)] max-w-md mx-auto">{hint}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
