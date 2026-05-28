import { Icon } from '@/components/ui/Icon';
import { MockTag } from '@/components/provenance/MockTag';
import { cn } from '@/lib/cn';

/** Inline feedback for a scratch-mode upload attempt. The `onDismiss`-less
 *  shape callers hold in state before rendering. */
export interface UploadNote {
  tone: 'success' | 'warning';
  title: string;
  detail: string;
}

interface UploadResultNoteProps extends UploadNote {
  onDismiss?: () => void;
}

/** Inline feedback after a scratch-mode upload attempt. */
export function UploadResultNote({ tone, title, detail, onDismiss }: UploadResultNoteProps) {
  const success = tone === 'success';
  return (
    <div
      className={cn(
        'mt-3 rounded-[3px] border px-3.5 py-2.5 flex items-start gap-2.5',
        success
          ? 'border-[var(--color-moss)]/40 bg-[var(--color-moss)]/8'
          : 'border-[rgba(160,122,46,0.4)] bg-[rgba(160,122,46,0.07)]',
      )}
    >
      {success ? (
        <Icon.Check size={14} className="mt-[2px] shrink-0 text-[var(--color-moss)]" />
      ) : (
        <Icon.Alert size={14} className="mt-[2px] shrink-0 text-[var(--color-day-rehearsal)]" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-[var(--color-ink)] inline-flex items-center gap-1">
          {title}
          <MockTag source="scratch_tour" field="Imported from a sample file" />
        </div>
        <div className="text-[12px] text-[var(--color-ink-3)] leading-snug mt-0.5">{detail}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[var(--color-ink-4)] hover:text-[var(--color-ink)]"
          aria-label="Dismiss"
        >
          <Icon.X size={13} />
        </button>
      )}
    </div>
  );
}
