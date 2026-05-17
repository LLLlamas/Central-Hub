import { MockTag } from '@/components/provenance/MockTag';
import { Icon } from '@/components/ui/Icon';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { UpdateStamp } from '@/types';

interface LastUpdatedProps {
  stamp?: UpdateStamp;
  className?: string;
}

/**
 * Calm "Last updated {date} by {name}" line for day-level records that
 * change and where readers need to trust freshness — see the day sheet,
 * day detail, and Today screens.
 *
 * The line itself prints (useful on a backstage-posted sheet); only the
 * MockTag self-hides in print.
 */
export function LastUpdated({ stamp, className }: LastUpdatedProps) {
  if (!stamp) return null;
  const date = fmtDate(stamp.at, 'MMM d, yyyy');
  const time = fmtDate(stamp.at, 'h:mm a');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 align-middle text-[11.5px] text-[var(--color-ink-3)]',
        className,
      )}
      title={`Last updated ${date} at ${time} by ${stamp.by}`}
    >
      <Icon.Clock size={12} className="shrink-0 text-[var(--color-ink-4)]" />
      <span>
        Last updated{' '}
        <span className="font-medium text-[var(--color-ink-2)]">{date}</span>
        {' '}by{' '}
        <span className="font-semibold text-[var(--color-ink-2)]">{stamp.by}</span>
      </span>
      <MockTag source="audit_trail" field="Last updated" />
    </span>
  );
}
