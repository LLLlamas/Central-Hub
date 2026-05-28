import { useState } from 'react';
import { getRealSource, type RealSourceKey } from '@/data/realSources';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { linkifyRiderRefs } from '@/components/RiderRef';
import { usePdfViewer } from '@/components/PdfViewer';
import { cn } from '@/lib/cn';

interface SourceTagProps {
  source: RealSourceKey;
  /** Optional name of the specific field this tag annotates, for the modal title. */
  field?: string;
  className?: string;
}

/**
 * Tiny inline "(i)" indicator placed next to any REAL value that came from
 * the rider PDF or a user entry. Click to open a popup showing exactly
 * which document, section, and page the value originated from — plus a
 * link to open the source artifact.
 *
 * Symmetric counterpart to <MockTag /> — same modal pattern, ocean-blue
 * theme instead of mock-purple. Together they make every value on screen
 * traceable to its origin.
 */
export function SourceTag({ source, field, className }: SourceTagProps) {
  const [open, setOpen] = useState(false);
  const { openPdf } = usePdfViewer();
  const src = getRealSource(source);

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
          'text-[var(--color-ocean)] hover:text-[var(--color-paper)]',
          'border border-[var(--color-ocean)]/40 hover:bg-[var(--color-ocean)]',
          'transition-colors cursor-help mx-0.5 print:hidden',
          className,
        )}
        title="Source — click for details"
        aria-label={`Source: ${src.section}. Click for details.`}
      >
        <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>i</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Real data · where it came from"
        title={field ?? src.section}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1">
              Document
            </div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)] leading-tight">
              {src.document}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1">
                Section
              </div>
              <div className="text-[12.5px] text-[var(--color-ink-2)]">{linkifyRiderRefs(src.section)}</div>
            </div>
            {src.pages && src.pages.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1">
                  Page{src.pages.length > 1 ? 's' : ''}
                </div>
                <div className="font-mono tabular text-[12.5px] text-[var(--color-ink-2)]">
                  {src.pages.join(', ')}
                </div>
              </div>
            )}
          </div>

          {src.quote && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1">
                Exact words from the rider
              </div>
              <blockquote className="border-l-2 border-[var(--color-ocean)] pl-3 text-[12.5px] text-[var(--color-ink-2)] italic leading-[1.5]">
                {src.quote}
              </blockquote>
            </div>
          )}

          {src.detail && (
            <p className="text-[12px] text-[var(--color-ink-3)] leading-relaxed">{linkifyRiderRefs(src.detail)}</p>
          )}

          {src.artifactUrl && (
            <button
              type="button"
              onClick={() =>
                openPdf({
                  url: src.artifactUrl!,
                  page: src.pages?.[0],
                  title: src.artifactLabel ?? src.document,
                })
              }
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-[3px] border border-[var(--color-ocean)]/40 hover:border-[var(--color-ocean)] hover:bg-[var(--color-paper-2)]/50 transition-colors group"
            >
              <span className="font-mono w-6 h-6 flex items-center justify-center rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-ocean)] text-[12px]">
                📕
              </span>
              <span className="flex-1 text-[12.5px] font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-ocean)]">
                {src.artifactLabel ?? 'Open source document'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                View
              </span>
              <Icon.Arrow size={12} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-ocean)]" />
            </button>
          )}

          <p className="pt-3 border-t border-[var(--color-rule-soft)] text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
            This value is REAL — it came directly from the source above.
          </p>
        </div>
      </Modal>
    </>
  );
}
