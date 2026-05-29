import type { ReactNode, MouseEvent } from 'react';
import { getRiderSection } from '@/lib/riderSections';
import { usePdfViewer } from '@/components/PdfViewer';
import { useApp } from '@/state/AppState';
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

const linkStyle =
  'p-0 bg-transparent border-0 cursor-pointer text-[var(--color-ocean)] hover:text-[var(--color-ink)] ' +
  'underline decoration-dotted underline-offset-[3px] decoration-[var(--color-ocean)]/40 hover:decoration-solid transition-colors';

/**
 * Clickable rider-section reference.
 *
 * Renders as `Stage specs (p.4)` by default — name first, page in parens.
 * In `short` mode renders just `p.4` (used by `linkifyRiderRefs` to swap
 * inline `§N` substrings without duplicating the section name that
 * usually follows them in surrounding text).
 *
 * Clicks open the rider PDF at the right page in the in-app PDF modal.
 * stopPropagation lets it work inside parent <Link> rows.
 */
export function RiderRef({ section, label, short, className }: RiderRefProps) {
  const { openPdf } = usePdfViewer();
  const { tour } = useApp();
  const s = getRiderSection(section);
  const pdfUrl = tour.riderImports[0]?.pdfObjectUrl;

  if (!s) {
    return (
      <span className={cn('font-mono', className)}>
        p.?
        {label && ` ${label}`}
      </span>
    );
  }

  // No rider uploaded → degrade to plain (non-clickable) text. We don't fake a
  // disabled-looking link that does nothing on click.
  if (!pdfUrl) {
    if (short) {
      return (
        <span className={cn('inline align-baseline font-mono tabular text-[var(--color-ink-3)]', className)}>
          p.{s.pages[0]}
        </span>
      );
    }
    return (
      <span className={cn('inline-flex items-baseline gap-1 align-baseline text-[var(--color-ink-3)]', className)}>
        <span>{label ?? s.name}</span>
        <span className="font-mono text-[0.85em]">(p.{s.pages[0]})</span>
      </span>
    );
  }

  const open = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openPdf({ url: pdfUrl, page: s.pages[0], title: `Rider — ${s.name}` });
  };

  if (short) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn('inline align-baseline font-mono tabular', linkStyle, className)}
        title={`View rider PDF — ${s.name} (page ${s.pages.join(' / ')})`}
      >
        p.{s.pages[0]}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn('inline-flex items-baseline gap-1 align-baseline text-left', linkStyle, className)}
      title={`View rider PDF at page ${s.pages.join(' / ')}`}
    >
      <span>{label ?? s.name}</span>
      <span className="font-mono text-[0.85em] text-[var(--color-ocean)]/80">
        (p.{s.pages[0]})
      </span>
    </button>
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
