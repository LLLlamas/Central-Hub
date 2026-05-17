import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { MockTag } from '@/components/provenance/MockTag';
import { SourceTag } from '@/components/provenance/SourceTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { ConflictFeed } from '@/components/ConflictFeed';
import { RouteMap } from '@/components/RouteMap';
import { TodaySurface } from '@/components/TodaySurface';
import { getAllConflicts } from '@/data/mockTour';
import type { RealSourceKey } from '@/data/realSources';
import { fmtFullDate, fmtDate, dayTypeLabel } from '@/lib/format';
import { MOCK_TODAY } from '@/lib/today';

export function TourOverview() {
  const { tour, lockedDays, densityMode, resolvedConflicts } = useApp();
  const today = MOCK_TODAY;

  const dayCounts = tour.days.reduce<Record<string, number>>((acc, d) => {
    acc[d.dayType] = (acc[d.dayType] || 0) + 1;
    return acc;
  }, {});

  const totalDays = tour.days.length;
  const showDays = dayCounts.show ?? 0;
  const travelDays = dayCounts.travel ?? 0;
  const offDays = dayCounts.off ?? 0;
  const conflicts = getAllConflicts();
  const unresolvedCount = conflicts.filter((c) => !resolvedConflicts.has(c.id)).length;
  const lockedCount = lockedDays.size;
  const upcoming = tour.days.filter((d) => d.date >= today).slice(0, densityMode === 'simple' ? 4 : 6);
  const simple = densityMode === 'simple';

  return (
    <div>
      <PageHeader
        eyebrow={tour.artistName}
        title="Today"
        description="The app opens on the operational day first. Everything else is still here, but the daily picture leads."
        actions={
          <Link
            to="/calendar"
            className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
          >
            <Icon.Calendar size={14} /> Calendar
          </Link>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="critical" variant="outline">On the road</Chip>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)]">
              Demo date: {fmtFullDate(today)}
              <MockTag source="tour_route" field="Pinned demo date" />
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)]">
              {fmtDate(tour.startDate, 'MMM d')} - {fmtDate(tour.endDate, 'MMM d, yyyy')}
              <MockTag source="tour_route" field="Tour dates" />
            </span>
          </div>
        }
      />

      <TodaySurface />

      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total days" value={totalDays} sublabel={`${tour.legs.length} legs`} mockSource="tour_route" />
        <Stat label="Shows" value={showDays} tone="show" mockSource="tour_route" />
        <Stat label="Travel" value={travelDays} tone="travel" mockSource="tour_route" />
        <Stat label="Off" value={offDays} tone="off" mockSource="tour_route" />
        <Stat label="Locked" value={`${lockedCount}/${totalDays}`} sublabel="Closed out" />
        <Stat label="Conflicts" value={unresolvedCount} sublabel={unresolvedCount === 0 ? 'All clear' : 'Need decision'} />
      </div>

      {simple ? (
        <details className="card mt-5 overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 text-[13px] font-semibold text-[var(--color-ink)]">
            Tour shape and rider facts
          </summary>
          <div className="border-t border-[var(--color-rule-soft)] p-5 space-y-5">
            <UpcomingDays days={upcoming} />
            <RiderFacts />
          </div>
        </details>
      ) : (
        <>
          {conflicts.length > 0 && (
            <div className="mt-5">
              <ConflictFeed limit={3} compact />
            </div>
          )}

          <div className="mt-7">
            <RouteMap />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <SectionCard
              title="Upcoming days"
              eyebrow={`Next ${upcoming.length}`}
              className="lg:col-span-2"
              action={
                <Link to="/calendar" className="text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
                  View calendar
                </Link>
              }
            >
              <UpcomingDays days={upcoming} flush />
            </SectionCard>

            <Card>
              <RiderFacts />
            </Card>
          </div>
        </>
      )}

      <DataSourcesPanel
        sourceKeys={['tour', 'tour_route', 'leg', 'day', 'tour_person', 'group', 'rider_cover_contacts']}
        intro="The overview blends real rider data with mocked route, venue, and schedule data. Source tags stay visible in both Simple and Pro while this prototype is being built."
      />
    </div>
  );
}

function UpcomingDays({ days, flush = false }: { days: ReturnType<typeof useApp>['tour']['days']; flush?: boolean }) {
  if (days.length === 0) {
    return <div className="text-center py-6 text-[13px] text-[var(--color-ink-3)]">No days to show.</div>;
  }

  return (
    <ul className={flush ? 'divide-y divide-[var(--color-rule-soft)] -mx-6 -my-2' : 'divide-y divide-[var(--color-rule-soft)]'}>
      {days.map((d) => (
        <li key={d.id}>
          <Link
            to={`/calendar/${d.date}`}
            className={cnList(
              'flex items-center gap-4 py-3 hover:bg-[var(--color-paper)]/50',
              flush ? 'px-6' : 'px-0',
            )}
          >
            <div className="w-12 shrink-0 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
                {fmtDate(d.date, 'EEE')}
              </div>
              <div className="font-display text-[22px] font-bold leading-none tabular text-[var(--color-ink)]">
                {fmtDate(d.date, 'd')}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
                {fmtDate(d.date, 'MMM')}
              </div>
            </div>
            <div
              className="w-1 self-stretch rounded-full"
              style={{ background: `var(--color-day-${d.dayType})` }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Chip tone={d.dayType} size="sm">
                  {dayTypeLabel(d.dayType)}
                </Chip>
                {d.city && (
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                    {d.city}
                  </span>
                )}
                <MockTag source="tour_route" field="City / venue" />
              </div>
              {d.notes && (
                <div className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">{d.notes}</div>
              )}
            </div>
            <Icon.Chevron size={14} className="text-[var(--color-ink-4)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RiderFacts() {
  const { tour } = useApp();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div className="text-[13px] font-semibold text-[var(--color-ink)]">From the rider</div>
        <SourceTag source="rider_cover" field="Rider cover" />
      </div>
      <ol className="space-y-2.5 text-[12.5px]">
        <FactRow label="Artist" value={tour.artistName} sourceKey="rider_artist" />
        <FactRow label="Tour" value={tour.name} sourceKey="rider_cover" />
        <FactRow label="Party size" value={`${tour.riderImports[0]?.partySize?.tourists ?? '-'} people`} sourceKey="rider_party_size" />
        <FactRow label="Hotel rooms" value={String(tour.riderImports[0]?.partySize?.rooms ?? '-')} sourceKey="rider_rooms" />
        <FactRow label="Flight tickets" value={String(tour.riderImports[0]?.partySize?.flightTickets ?? '-')} sourceKey="rider_flight_tickets" />
        <FactRow
          label="PM"
          value={tour.riderImports[0]?.productionManager?.name ?? '-'}
          sub={tour.riderImports[0]?.productionManager?.phone}
          sourceKey="rider_pm_contact"
        />
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone,
  mockSource,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'show' | 'travel' | 'off';
  mockSource?: 'tour_route' | 'schedule_item';
}) {
  const color =
    tone === 'show'
      ? 'var(--color-day-show)'
      : tone === 'travel'
      ? 'var(--color-day-travel)'
      : tone === 'off'
      ? 'var(--color-day-off)'
      : 'var(--color-ink)';
  return (
    <div className="card px-4 py-3">
      <div className="eyebrow flex items-center justify-between">
        <span>{label}</span>
        {mockSource && <MockTag source={mockSource} field={label} />}
      </div>
      <div className="font-display text-[32px] leading-none font-bold mt-1.5 tabular" style={{ color }}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-[11.5px] text-[var(--color-ink-3)]">{sublabel}</div>}
    </div>
  );
}

function FactRow({
  label,
  value,
  sub,
  sourceKey,
}: {
  label: string;
  value: string;
  sub?: string;
  sourceKey?: RealSourceKey;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-[var(--color-rule-soft)] pb-1.5 last:border-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] shrink-0">
        {label}
      </span>
      <div className="text-right min-w-0">
        <span className="inline-flex items-baseline gap-1">
          <span className="font-semibold text-[var(--color-ink)] truncate">{value}</span>
          {sourceKey && <SourceTag source={sourceKey} field={label} />}
        </span>
        {sub && <div className="font-mono text-[10.5px] tabular text-[var(--color-ink-3)]">{sub}</div>}
      </div>
    </li>
  );
}

function cnList(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
