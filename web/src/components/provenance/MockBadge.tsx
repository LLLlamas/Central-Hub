import { useState } from 'react';
import { getSource, realSourceLabels, phaseLabels, type SourceKey } from '@/data/sources';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';

interface MockBadgeProps {
  source: SourceKey;
  /** Optional override label (defaults to "MOCK"). */
  label?: string;
  /** Show inline as tiny pill, or as a fuller info-strip. */
  variant?: 'pill' | 'strip';
  className?: string;
}

/**
 * Visual indicator that a piece of data is mocked, with a hover-to-reveal
 * tooltip explaining where the data should come from in production.
 *
 * Pulls from src/data/sources.ts — the single registry of provenance.
 */
export function MockBadge({ source, label = 'Mock', variant = 'pill', className }: MockBadgeProps) {
  const [open, setOpen] = useState(false);
  const prov = getSource(source);

  if (variant === 'strip') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-[4px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)]/40 px-3 py-2.5',
          className,
        )}
      >
        <Chip tone="mock" variant="outline" uppercase>
          Mock data
        </Chip>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[var(--color-ink-2)] leading-tight">
            {prov.source}
          </div>
          {prov.detail && (
            <p className="mt-1 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
              {prov.detail}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip tone="neutral" size="sm">
              {realSourceLabels[prov.realSource]}
            </Chip>
            <Chip tone="neutral" size="sm">
              {phaseLabels[prov.phase]}
            </Chip>
          </div>
        </div>
      </div>
    );
  }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center"
        aria-label={`Mock data: ${prov.source}`}
      >
        <Chip tone="mock" variant="outline" uppercase>
          {label}
        </Chip>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 top-full left-0 mt-1.5 w-[320px] rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] p-3 shadow-lg text-left"
          style={{ boxShadow: '0 10px 30px rgba(21,19,15,0.10)' }}
        >
          <div className="text-[10.5px] font-mono font-semibold tracking-[0.14em] uppercase text-[#7a5a8a]">
            Mocked · where it comes from
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-[var(--color-ink)] leading-tight">
            {prov.source}
          </div>
          {prov.detail && (
            <p className="mt-1.5 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
              {prov.detail}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip tone="neutral" size="sm">
              {realSourceLabels[prov.realSource]}
            </Chip>
            <Chip tone="neutral" size="sm">
              {phaseLabels[prov.phase]}
            </Chip>
          </div>
        </span>
      )}
    </span>
  );
}
