import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { collectRecentUpdates, type FeedEntry } from '@/lib/updatesFeed';

const COMPACT_FEED_LIMIT = 8;

/**
 * Crew-facing "what changed recently" feed — a derived, read-only view over
 * every edit-history overlay AppState tracks. No gating on managerView: the
 * whole point is a member can see what changed without asking anyone.
 */
export function UpdatesFeed({
  className,
  limit = COMPACT_FEED_LIMIT,
  bare = false,
}: {
  className?: string;
  /** Skip the card background/border — for placements already inside a bordered container. */
  bare?: boolean;
  limit?: number;
}) {
  const {
    scheduleItemEditHistory,
    sectionEditHistory,
    visibilityEditHistory,
    dayLockHistory,
    resolvedConflicts,
    negotiations,
    showAdvances,
  } = useApp();

  const entries = useMemo(
    () =>
      collectRecentUpdates(
        {
          scheduleItemEditHistory,
          sectionEditHistory,
          visibilityEditHistory,
          dayLockHistory,
          resolvedConflicts,
          negotiations,
          showAdvances,
        },
        limit,
      ),
    [
      scheduleItemEditHistory,
      sectionEditHistory,
      visibilityEditHistory,
      dayLockHistory,
      resolvedConflicts,
      negotiations,
      showAdvances,
      limit,
    ],
  );

  return (
    <div className={cn(!bare && 'card p-4', className)}>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon.Clock size={13} className="text-[var(--color-ink-4)]" />
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Recent updates</h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-[var(--color-ink-3)]">
          Nothing's changed yet — this fills in as the tour comes together.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry, i) => (
            <FeedRow key={`${entry.surface}-${entry.at}-${i}`} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const date = fmtDate(entry.at, 'MMM d');
  const time = fmtDate(entry.at, 'h:mm a');
  const body = (
    <>
      <p className="text-[12.5px] leading-snug text-[var(--color-ink)]">{entry.label}</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-3)]">
        {date} at {time} · by <span className="font-semibold text-[var(--color-ink-2)]">{entry.by}</span>
      </p>
    </>
  );

  if (entry.href) {
    return (
      <li>
        <Link
          to={entry.href}
          className="-mx-1.5 block rounded-[3px] px-1.5 py-0.5 hover:bg-[var(--color-paper)]/60"
        >
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}
