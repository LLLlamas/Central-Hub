import { useState } from 'react';
import { getSource, realSourceLabels, phaseLabels, type SourceKey, type ProvenanceArtifact } from '@/data/sources';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { usePdfViewer } from '@/components/PdfViewer';
import { cn } from '@/lib/cn';

interface MockTagProps {
  source: SourceKey;
  /** Override the displayed label (default: "(mock)"). */
  label?: string;
  /** Optional note specific to this value (overrides registry detail). */
  note?: string;
  /** Optional name of the specific field this tag annotates, for the modal title. */
  field?: string;
  className?: string;
}

function ArtifactLink({ artifact }: { artifact: ProvenanceArtifact }) {
  const { openPdf } = usePdfViewer();
  const iconChar =
    artifact.kind === 'csv'
      ? '▦'
      : artifact.kind === 'doc'
      ? '📄'
      : artifact.kind === 'pdf'
      ? '📕'
      : artifact.kind === 'email'
      ? '✉'
      : artifact.kind === 'image'
      ? '◧'
      : '◰';
  const cls =
    'flex items-center gap-2.5 px-3 py-2 rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] hover:bg-[var(--color-paper-2)]/50 transition-colors group';
  const inner = (
    <>
      <span className="font-mono w-6 h-6 flex items-center justify-center rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] text-[12px]">
        {iconChar}
      </span>
      <span className="flex-1 text-[12.5px] font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
        {artifact.label}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
        {artifact.kind === 'pdf' ? 'View' : 'Open'}
      </span>
      <Icon.Arrow size={12} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-accent)]" />
    </>
  );
  return (
    <li>
      {artifact.kind === 'pdf' ? (
        <button
          type="button"
          onClick={() => openPdf({ url: artifact.url, title: artifact.label })}
          className={cn('w-full text-left', cls)}
        >
          {inner}
        </button>
      ) : (
        <a href={artifact.url} target="_blank" rel="noopener noreferrer" className={cls}>
          {inner}
        </a>
      )}
    </li>
  );
}

/**
 * Tiny inline "(mock)" indicator placed next to any value that is currently
 * mocked data. Click to open a popup explaining where the data should come
 * from in production (real-system source, lifecycle phase, detail).
 *
 * Designed to be unobtrusive — small grey text that doesn't disrupt the
 * normal reading flow, but is always visible so users know what's mocked.
 */
export function MockTag({ source, label = '(mock)', note, field, className }: MockTagProps) {
  const [open, setOpen] = useState(false);
  const prov = getSource(source);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Stop the click from bubbling up to parent links / row handlers.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          'font-mono text-[9.5px] font-medium uppercase tracking-[0.10em] align-middle',
          'text-[var(--color-ink-4)] hover:text-[#7a5a8a] cursor-help',
          'transition-colors mx-0.5 print:hidden',
          className,
        )}
        title="Mocked — click for source"
        aria-label={`Mocked data: ${prov.source}. Click for details.`}
      >
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Mock data · where it comes from"
        title={field ?? prov.source}
        size="sm"
      >
        {field && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1.5">
            Real source
          </p>
        )}
        <p className="text-[13.5px] font-semibold text-[var(--color-ink)] leading-snug">
          {prov.source}
        </p>

        {(note ?? prov.detail) && (
          <p className="mt-2.5 text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
            {note ?? prov.detail}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip tone="neutral" variant="outline">
            {realSourceLabels[prov.realSource]}
          </Chip>
          <Chip tone="neutral" variant="outline">
            {phaseLabels[prov.phase]}
          </Chip>
        </div>

        {prov.artifacts && prov.artifacts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-rule-soft)]">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ink-3)] mb-2">
              Mock source documents
            </div>
            <ul className="space-y-1.5">
              {prov.artifacts.map((a) => (
                <ArtifactLink key={a.url} artifact={a} />
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] text-[var(--color-ink-3)] leading-relaxed">
              These mock files stand in for the real documents the TM would
              receive in the booking phase. Open them to see what would populate
              this field.
            </p>
          </div>
        )}

        <p className="mt-4 pt-3 border-t border-[var(--color-rule-soft)] text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
          This value is not from the rider PDF. It will be replaced by real data when this part of the pipeline is wired up.
        </p>
      </Modal>
    </>
  );
}
