import type { ReactNode } from 'react';
import { getRiderSection, riderPageUrl } from '@/lib/riderSections';
import { cn } from '@/lib/cn';

interface RiderRefProps {
  /** Section number (e.g. 4) or RiderSectionType string (e.g. 'stage_specs'). */
  section: number | string;
  /** Override label after the section. Default: the section's canonical name. */
  label?: string;
  /** Compact mode — render only "p.N" (used inline in free-text replacements). */
  short?: boolean;
  className?: string;
}

/**
 * Clickable rider-section reference.
 *
 * Renders as `Stage specs (p.4)` by default — name first, page in parens.
 * In `short` mode renders just `p.4` (used by `linkifyRiderRefs` to swap
 * inline `§N` substrings without duplicating the section name that
 * usually follows them in surrounding text).
 *
 * Clicks open the rider PDF at the right page (#page=N) in a new tab.
 * stopPropagation lets the link work inside parent <Link> rows.
 */
export function RiderRef({ section, label, short, className }: RiderRefProps) {
  const s = getRiderSection(section);

  if (!s) {
    return (
      <span className={cn('font-mono', className)}>
        p.?
        {label && ` ${label}`}
      </span>
    );
  }

  if (short) {
    return (
      <a
        href={riderPageUrl(s.pages)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-baseline font-mono tabular',
          'text-[var(--color-ocean)] hover:text-[var(--color-ink)]',
          'underline decoration-dotted underline-offset-[3px] decoration-[var(--color-ocean)]/40 hover:decoration-solid',
          'transition-colors',
          className,
        )}
        title={`Open rider PDF — ${s.name} (page ${s.pages.join(' / ')})`}
      >
        p.{s.pages[0]}
      </a>
    );
  }

  return (
    <a
      href={riderPageUrl(s.pages)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-baseline gap-1 align-baseline',
        'text-[var(--color-ocean)] hover:text-[var(--color-ink)]',
        'underline decoration-dotted underline-offset-[3px] decoration-[var(--color-ocean)]/40 hover:decoration-solid',
        'transition-colors',
        className,
      )}
      title={`Open rider PDF at page ${s.pages.join(' / ')}`}
    >
      <span>{label ?? s.name}</span>
      <span className="font-mono text-[0.85em] text-[var(--color-ocean)]/80">
        (p.{s.pages[0]})
      </span>
    </a>
  );
}

/**
 * Walk a free-text string and replace every `§N` (or `§ N`) substring
 * with a clickable `<RiderRef short />` ("p.N" link). The surrounding
 * section name (which usually follows the §N in the original text) is
 * left in place, so "between §4 stage specs and §8 lighting" reads as
 * "between p.4 stage specs and p.9 lighting" with the page numbers
 * being the clickable links.
 */
export function linkifyRiderRefs(
  text: string | undefined,
  refClassName?: string,
): ReactNode {
  if (!text) return text;
  const parts = text.split(/(§\s*\d+)/);
  return parts.map((p, i) => {
    const m = p.match(/^§\s*(\d+)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      return <RiderRef key={i} section={num} short className={refClassName} />;
    }
    return p;
  });
}
