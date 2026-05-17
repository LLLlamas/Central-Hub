import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-7">
      {eyebrow && <div className="eyebrow mb-2 text-[var(--color-accent)]">{eyebrow}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[32px] sm:text-[40px] leading-[0.98] font-bold text-[var(--color-ink)]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-[14px] leading-[1.55] text-[var(--color-ink-3)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  );
}
