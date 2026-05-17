import { NavLink, Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { MockTag } from '@/components/provenance/MockTag';
import { SourceTag } from '@/components/provenance/SourceTag';
import { getAllConflicts } from '@/data/mockTour';
import { cn } from '@/lib/cn';
import { fmtDate, daysBetween } from '@/lib/format';
import { MOCK_TODAY } from '@/lib/today';

type NavEntry = {
  to: string;
  label: string;
  icon: keyof typeof Icon;
  group: 'tour' | 'ops' | 'ingest';
};

const nav: NavEntry[] = [
  { to: '/', label: 'Today', icon: 'Home', group: 'tour' },
  { to: '/calendar', label: 'Calendar', icon: 'Calendar', group: 'tour' },
  { to: '/personnel', label: 'People', icon: 'Users', group: 'tour' },
  { to: '/schedule', label: 'Schedule', icon: 'Layers', group: 'ops' },
  { to: '/daysheet', label: 'Day Sheets', icon: 'Document', group: 'ops' },
  { to: '/ingest/flights', label: 'Import flights', icon: 'Plane', group: 'ingest' },
  { to: '/ingest/riders', label: 'Import rider', icon: 'Sparkle', group: 'ingest' },
];

const groupLabels: Record<NavEntry['group'], string> = {
  tour: 'Tour',
  ops: 'Daily ops',
  ingest: 'Power tools',
};

export function Sidebar() {
  const { tour, lockedDays, resolvedConflicts } = useApp();
  const today = MOCK_TODAY;
  const dToStart = daysBetween(today, tour.startDate);
  const dToEnd = daysBetween(today, tour.endDate);
  const allConflicts = getAllConflicts();
  const unresolvedConflictCount = allConflicts.filter((c) => !resolvedConflicts.has(c.id)).length;
  const lockedCount = lockedDays.size;

  const stateLabel =
    tour.status === 'wrapped'
      ? 'Wrapped'
      : dToStart > 0
      ? `Kickoff in ${dToStart}d`
      : dToEnd >= 0
      ? `On the road - ${Math.abs(daysBetween(tour.startDate, today)) + 1}/${daysBetween(tour.startDate, tour.endDate) + 1}`
      : 'Wrapped';

  return (
    <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[var(--color-rule)] bg-[var(--color-paper)]">
      <div className="px-5 pt-5 pb-4 border-b border-[var(--color-rule-soft)]">
        <div className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase text-[var(--color-ink-3)]">
          Tour Hub
        </div>
        <div className="mt-3 font-display text-[20px] leading-[1.05] font-bold text-[var(--color-ink)] inline-flex items-baseline gap-1">
          {tour.name}
          <SourceTag source="rider_cover" field="Tour name" />
        </div>
        <div className="mt-0.5 text-[12px] text-[var(--color-ink-3)] font-semibold inline-flex items-baseline gap-1">
          {tour.artistName}
          <SourceTag source="rider_artist" field="Artist name" />
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Chip tone="critical" variant="outline">
            {stateLabel}
          </Chip>
        </div>
        <div className="mt-2.5 font-mono text-[10.5px] text-[var(--color-ink-4)] tabular inline-flex items-center gap-1">
          {fmtDate(tour.startDate, 'MMM d')} - {fmtDate(tour.endDate, 'MMM d, yyyy')}
          <MockTag source="tour_route" field="Tour dates" />
        </div>
        <div className="mt-1.5 text-[11px] font-semibold text-[var(--color-ink-3)] inline-flex items-center gap-1">
          Demo date: {fmtDate(today, 'MMM d, yyyy')}
          <MockTag source="tour_route" field="Pinned demo date" />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-rule-soft)] flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div
            className="inline-flex items-center gap-1 text-[10.5px] font-mono tabular text-[var(--color-ink-3)]"
            title={`${lockedCount} of ${tour.days.length} days locked / closed out`}
          >
            <Icon.Lock size={10} className="text-[var(--color-accent)]" />
            <span>{lockedCount}/{tour.days.length} locked</span>
          </div>
          {unresolvedConflictCount > 0 ? (
            <Link
              to="/ingest/riders"
              className="inline-flex items-center gap-1 text-[10.5px] font-mono tabular text-[var(--color-accent)] hover:text-[var(--color-ink)]"
              title={`${unresolvedConflictCount} unresolved rider conflict${unresolvedConflictCount === 1 ? '' : 's'} - click to review`}
            >
              <Icon.Alert size={10} />
              <span>{unresolvedConflictCount} unresolved</span>
            </Link>
          ) : (
            allConflicts.length > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-mono tabular text-[var(--color-moss)]"
                title={`All ${allConflicts.length} rider conflicts resolved`}
              >
                <Icon.Check size={10} />
                <span>All resolved</span>
              </span>
            )
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {(['tour', 'ops', 'ingest'] as const).map((groupKey) => (
          <div key={groupKey} className="px-3 mb-4">
            <div className="px-2 mb-1.5 font-mono text-[9.5px] font-semibold tracking-[0.18em] uppercase text-[var(--color-ink-4)]">
              {groupLabels[groupKey]}
            </div>
            <ul className="space-y-0.5">
              {nav.filter((n) => n.group === groupKey).map((entry) => {
                const I = Icon[entry.icon];
                return (
                  <li key={entry.to}>
                    <NavLink
                      to={entry.to}
                      end={entry.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-[3px] text-[13px] font-semibold transition-colors',
                          isActive
                            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                            : 'text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]',
                        )
                      }
                    >
                      <I size={15} />
                      <span>{entry.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-[var(--color-rule-soft)] text-[11px] text-[var(--color-ink-4)] leading-relaxed">
        <div className="font-semibold text-[var(--color-ink-3)] mb-1">
          Calm by default. Detail on demand.
        </div>
        Pro keeps every tool close; Simple tucks secondary panels away.
      </div>
    </aside>
  );
}
