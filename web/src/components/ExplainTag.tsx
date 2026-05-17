import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { usePdfViewer } from '@/components/PdfViewer';
import { RIDER_PDF_PATH, getRiderSection } from '@/lib/riderSections';
import { cn } from '@/lib/cn';
import type { Conflict } from '@/types';

/** Optional "open the rider" button rendered at the bottom of the popup. */
interface RiderLink {
  /** Section number (§N) or RiderSectionType — resolved to a page. */
  section?: number | string;
  /** Explicit page, overrides `section`. */
  page?: number;
  /** Button label. Defaults to "Open the rider". */
  label?: string;
}

interface ExplainTagProps {
  /** Modal heading — the warning restated as a question, e.g. "What does this mean?". */
  title?: string;
  /** Plain-English body. A string, or rich content (paragraphs etc.). */
  children: ReactNode;
  /** Optional rider-page link shown as a button inside the popup. */
  riderLink?: RiderLink;
  /** Accessible label for the trigger. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Tiny inline "(?)" indicator placed next to any red/alert warning. Click to
 * open a popup that explains the jargon-heavy warning in plain, non-technical
 * English — so a non-expert user understands what they're looking at and why
 * it matters.
 *
 * Same modal pattern as <SourceTag /> / <MockTag />, neutral-amber theme.
 * stopPropagation + preventDefault let it sit inside parent <Link> rows.
 */
export function ExplainTag({
  title = 'What does this mean?',
  children,
  riderLink,
  ariaLabel,
  className,
}: ExplainTagProps) {
  const [open, setOpen] = useState(false);
  const { openPdf } = usePdfViewer();

  const page =
    riderLink?.page ??
    (riderLink?.section != null ? getRiderSection(riderLink.section)?.pages[0] : undefined);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          'inline-flex items-center justify-center align-middle',
          'w-[14px] h-[14px] rounded-full',
          'text-[10px] font-bold leading-none',
          'text-[var(--color-gold)] hover:text-[var(--color-paper)]',
          'border border-[var(--color-gold)]/45 hover:bg-[var(--color-gold)]',
          'transition-colors cursor-help mx-0.5 print:hidden',
          className,
        )}
        title="What does this mean? — click for a plain-English explanation"
        aria-label={ariaLabel ?? 'Explain this warning'}
      >
        <span style={{ fontFamily: 'Georgia, serif' }}>?</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="In plain English"
        title={title}
        size="sm"
      >
        <div className="space-y-3 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
          {typeof children === 'string' ? <p>{children}</p> : children}
        </div>

        {page != null && (
          <button
            type="button"
            onClick={() =>
              openPdf({ url: RIDER_PDF_PATH, page, title: 'Rider PDF' })
            }
            className="mt-4 w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-[3px] border border-[var(--color-gold)]/40 hover:border-[var(--color-gold)] hover:bg-[var(--color-paper-2)]/50 transition-colors group"
          >
            <span className="font-mono w-6 h-6 flex items-center justify-center rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-gold)] text-[12px]">
              📕
            </span>
            <span className="flex-1 text-[12.5px] font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-gold)]">
              {riderLink?.label ?? `Open the rider at page ${page}`}
            </span>
            <Icon.Arrow size={12} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-gold)]" />
          </button>
        )}

        <p className="mt-4 pt-3 border-t border-[var(--color-rule-soft)] text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
          Plain-English help · this note isn't part of the rider.
        </p>
      </Modal>
    </>
  );
}

/**
 * Preset <ExplainTag /> for a "Sensitive" / "Hidden in print" marker. Used on
 * schedule items and hotels across the day detail, day sheets, schedule, and
 * print views.
 */
export function SensitiveExplain() {
  return (
    <ExplainTag
      title="What does “sensitive” mean?"
      ariaLabel="Explain the sensitive marker"
    >
      <p>
        This item is marked sensitive — it's hidden from people who don't need
        it, such as the artist's hotel, drivers, or private press.
      </p>
      <p>
        It won't appear on shared or printed day sheets. Only crew whose role
        needs it will see it in the app.
      </p>
    </ExplainTag>
  );
}

/**
 * Preset <ExplainTag /> for an "excluded brand / NOT this item" flag in the
 * backline and catering reviews.
 */
export function ExcludedBrandExplain({ section }: { section: number | string }) {
  return (
    <ExplainTag
      title="Why this item is crossed out"
      ariaLabel="Explain this excluded-brand flag"
      riderLink={{ section, label: 'Open this section in the rider' }}
    >
      <p>
        The rider specifically does <strong>not</strong> want this brand or
        item — it's an explicit exclusion, not a suggestion.
      </p>
      <p>
        Substituting it would break a real requirement from the artist's team
        (often a sponsorship clash or a known quality/allergy issue). Treat it
        as a hard "no".
      </p>
    </ExplainTag>
  );
}

/**
 * Preset <ExplainTag /> for a rider conflict. Used wherever a conflict is
 * surfaced (the conflict feed, the rider-ingest conflicts review) so the
 * plain-English explanation reads identically everywhere.
 */
export function ConflictExplain({ conflict }: { conflict: Conflict }) {
  const section = conflict.sectionsInvolved[0];
  return (
    <ExplainTag
      title="What does this conflict mean?"
      ariaLabel="Explain this rider conflict"
      riderLink={section != null ? { section, label: 'Open this section in the rider' } : undefined}
    >
      <p>
        Two parts of the rider say things that don't match — for example one
        section asks for a count or a spec that another section contradicts.
      </p>
      <p>
        The app never guesses which one is right. A person reviews both,
        decides, and records the correct value. Until then the conflict stays
        flagged.
      </p>
    </ExplainTag>
  );
}
