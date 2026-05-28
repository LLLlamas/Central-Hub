import { useState } from 'react';
import { getSource, realSourceLabels, phaseLabels, type SourceKey, type ProvenanceArtifact, type LiveSource } from '@/data/sources';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { usePdfViewer } from '@/components/PdfViewer';
import { useApp } from '@/state/AppState';
import { fmtFullDate } from '@/lib/format';
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

function LiveUploadBlock({ live }: { live: LiveSource }) {
  const { openPdf } = usePdfViewer();
  const iconChar = live.kind === 'csv' ? '▦' : '📕';
  const filenameCls =
    'flex items-center gap-2.5 px-3 py-2 rounded-[3px] border border-[var(--color-rule)] hover:border-[var(--color-ink-4)] hover:bg-[var(--color-paper-2)]/50 transition-colors group';
  const filenameInner = (
    <>
      <span className="font-mono w-6 h-6 flex items-center justify-center rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-ink-2)] text-[12px]">
        {iconChar}
      </span>
      <span className="flex-1 text-[12.5px] font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] break-all">
        {live.filename}
      </span>
      {live.kind === 'pdf' && (
        <>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            View
          </span>
          <Icon.Arrow size={12} className="text-[var(--color-ink-3)] group-hover:text-[var(--color-accent)]" />
        </>
      )}
    </>
  );
  return (
    <div className="rounded-[3px] border border-[var(--color-moss)]/40 bg-[var(--color-moss)]/8 px-3.5 py-3">
      <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-moss)] mb-1.5">
        From your uploaded file
      </div>
      {live.kind === 'pdf' && live.url ? (
        <button
          type="button"
          onClick={() => openPdf({ url: live.url!, title: live.filename })}
          className={cn('w-full text-left', filenameCls)}
        >
          {filenameInner}
        </button>
      ) : (
        <div className={cn('cursor-default', filenameCls)}>{filenameInner}</div>
      )}
      {live.stamp && (
        <div className="mt-2 text-[11.5px] text-[var(--color-ink-3)] leading-snug">
          Imported {fmtFullDate(live.stamp.at.slice(0, 10))} by{' '}
          <span className="font-semibold text-[var(--color-ink-2)]">{live.stamp.by}</span>
          {(live.stamp.updates ?? 0) > 0 ? ` · updated ${live.stamp.updates}×` : ''}
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed italic">
        {live.productionNote}
      </p>
    </div>
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
  const { tour } = useApp();
  const prov = getSource(source);
  const live = prov.resolveLive ? prov.resolveLive(tour) : null;
  const awaitingUpload = !!prov.resolveLive && !live;

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
        eyebrow={live ? 'Source · your upload' : 'Sample data · where it comes from'}
        title={field ?? prov.source}
        size="sm"
      >
        {field && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-1.5">
            {live ? 'Comes from' : 'Where it’ll come from'}
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

        {live && (
          <div className="mt-4">
            <LiveUploadBlock live={live} />
          </div>
        )}

        {awaitingUpload && (
          <div className="mt-4 rounded-[3px] border border-dashed border-[var(--color-rule)] px-3.5 py-3 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
            Nothing uploaded yet. Once you import the matching file, this will
            show the exact file it came from.
          </div>
        )}

        {!live && prov.artifacts && prov.artifacts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-rule-soft)]">
            <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ink-3)] mb-2">
              Sample files this would come from
            </div>
            <ul className="space-y-1.5">
              {prov.artifacts.map((a) => (
                <ArtifactLink key={a.url} artifact={a} />
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] text-[var(--color-ink-3)] leading-relaxed">
              These sample files stand in for the real documents a tour manager
              would receive. Open one to see what fills this in.
            </p>
          </div>
        )}

        <p className="mt-4 pt-3 border-t border-[var(--color-rule-soft)] text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-4)]">
          {live
            ? 'This came from the file above — sample data for now, the real file once it’s connected.'
            : 'This is sample data for now. It’ll be replaced by the real thing once this part is connected.'}
        </p>
      </Modal>
    </>
  );
}
