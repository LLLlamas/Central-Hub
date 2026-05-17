import { MockTag } from '@/components/provenance/MockTag';
import { Icon } from '@/components/ui/Icon';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { UpdateStamp } from '@/types';

interface LastUpdatedProps {
  stamp?: UpdateStamp;
  /** Leading label — defaults to "Last updated". Pass e.g. "Approved" for sign-off contexts. */
  label?: string;
  className?: string;
}

/**
 * Calm "{label} {date} by {name}" audit line for records that change and
 * where readers need to trust freshness — the day sheet, day detail, Today
 * screens (day-level), and approved rider sections ("Approved by …").
 *
 * The line itself prints (useful on a backstage-posted sheet); only the
 * MockTag self-hides in print.
 */
export function LastUpdated({ stamp, label = 'Last updated', className }: LastUpdatedProps) {
  if (!stamp) return null;
  const date = fmtDate(stamp.at, 'MMM d, yyyy');
  const time = fmtDate(stamp.at, 'h:mm a');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 align-middle text-[11.5px] text-[var(--color-ink-3)]',
        className,
      )}
      title={`${label} ${date} at ${time} by ${stamp.by}`}
    >
      <Icon.Clock size={12} className="shrink-0 text-[var(--color-ink-4)]" />
      <span>
        {label}{' '}
        <span className="font-medium text-[var(--color-ink-2)]">{date}</span>
        {' '}by{' '}
        <span className="font-semibold text-[var(--color-ink-2)]">{stamp.by}</span>
      </span>
      <MockTag source="audit_trail" field={label} />
    </span>
  );
}
