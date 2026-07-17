import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LastUpdated } from '@/components/LastUpdated';
import { getVenueForTour } from '@/data/venues';
import { threadKey, isShowFullyConfirmed } from '@/lib/negotiation';
import { tourPath } from '@/lib/routing';
import { fmtFullDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { isVenuePersona } from '@/lib/access';
import type { Day, NegotiationThread, ShowAdvance, ShowRiderStatus, Venue } from '@/types';

// Status chip styling — reuses Chip's existing tone palette rather than
// inventing new colors (see components/ui/Chip.tsx).
const STATUS_TONE: Record<ShowRiderStatus, 'neutral' | 'travel' | 'rehearsal' | 'success'> = {
  draft: 'neutral',
  sent: 'travel',
  in_negotiation: 'rehearsal',
  confirmed: 'success',
};

const STATUS_LABEL: Record<ShowRiderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  in_negotiation: 'In negotiation',
  confirmed: 'Confirmed',
};

/**
 * Venue-advance board — one row per show day. The TM/PM sends the rider to
 * each show's venue, the venue answers per item (simulated by switching the
 * viewer to that venue's grp_venue persona), and the two sides reconcile
 * until every item is confirmed. Not manager-gated at the route level: a
 * venue persona lands here too, scoped to just their own show(s), with the
 * manager actions hidden entirely.
 */
export function Advance() {
  const { tour, user, getShowAdvance, negotiations, sendRiderToVenue, markShowConfirmed } = useApp();

  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const venuePersona = isVenuePersona(user);

  const shows = useMemo(() => {
    const showDays = tour.days
      .filter((d) => d.dayType === 'show')
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!venuePersona) return showDays;
    return showDays.filter((d) => d.venueId && user.tourPersonId === `tp_venue_${d.venueId}`);
  }, [tour.days, venuePersona, user.tourPersonId]);

  const activeRider = tour.riderImports[0];
  const currentRiderRevision = activeRider?.revision;
  const hasRiderContent = (activeRider?.sections.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Venue advance"
        title="Advance board"
        description={
          venuePersona
            ? "The rider items requested for your show — answer each one so the tour manager can confirm the advance."
            : "Send the rider to each show's venue, track their answers per item, and reconcile any gaps until everything is confirmed."
        }
      />

      {shows.length === 0 ? (
        <EmptyState
          title={venuePersona ? 'No shows assigned to you yet' : 'No show days yet'}
          hint={
            venuePersona
              ? "Check back once the tour manager sends your venue's advance."
              : 'Import a route with show days and build the rider — once both are in place you can start advancing venues.'
          }
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-[var(--color-rule-soft)]">
            {shows.map((day) => (
              <ShowRow
                key={day.id}
                day={day}
                tourId={tour.id}
                venue={getVenueForTour(tour, day.venueId)}
                advance={getShowAdvance(day.id)}
                negotiations={negotiations}
                managerView={managerView}
                currentRiderRevision={currentRiderRevision}
                hasRiderContent={hasRiderContent}
                onSend={() => sendRiderToVenue(day.id)}
                onConfirm={() => markShowConfirmed(day.id)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ShowRow({
  day,
  tourId,
  venue,
  advance,
  negotiations,
  managerView,
  currentRiderRevision,
  hasRiderContent,
  onSend,
  onConfirm,
}: {
  day: Day;
  tourId: string;
  venue?: Venue;
  advance?: ShowAdvance;
  negotiations: ReadonlyMap<string, NegotiationThread>;
  managerView: boolean;
  currentRiderRevision?: number;
  hasRiderContent: boolean;
  onSend: () => void;
  onConfirm: () => void;
}) {
  // Stale (no-longer-in-the-rider) items don't count toward "confirmed" —
  // they're carried forward for the record, not part of the live ask.
  const items = (advance?.items ?? []).filter((it) => !it.stale);
  const totalCount = items.length;
  const confirmedCount = items.filter(
    (it) => negotiations.get(threadKey(day.id, it.itemKey))?.status === 'confirmed',
  ).length;
  const status: ShowRiderStatus = advance?.status ?? 'draft';
  const fullyConfirmed = !!advance && isShowFullyConfirmed(items, negotiations, day.id);
  const lastActivity = advance?.history[advance.history.length - 1];
  const riderStale =
    !!advance && currentRiderRevision !== undefined && advance.riderRevision !== currentRiderRevision;
  const canSend = !!day.venueId && hasRiderContent;
  const sendDisabledReason = !day.venueId
    ? 'Assign a venue for this show first'
    : !hasRiderContent
    ? 'Build the rider before sending it to a venue'
    : undefined;

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-[var(--color-paper-2)] transition-colors">
      <Link
        to={tourPath(tourId, `advance/${day.id}`)}
        className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4"
      >
        <div className="w-full sm:w-[150px] shrink-0 text-[13px] font-semibold text-[var(--color-ink)]">
          {fmtFullDate(day.date)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[var(--color-ink)] truncate">
            {venue?.name ?? 'Venue TBD'}
          </div>
          {(venue?.city ?? day.city) && (
            <div className="text-[11px] text-[var(--color-ink-3)] truncate">{venue?.city ?? day.city}</div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
          <Chip tone={STATUS_TONE[status]} size="sm">
            {STATUS_LABEL[status]}
          </Chip>
          {managerView && riderStale && status !== 'confirmed' && (
            <Chip tone="rehearsal" size="sm">
              Rider updated since last send
            </Chip>
          )}
        </div>
        <div className="w-full sm:w-[130px] shrink-0 text-[12px] font-mono text-[var(--color-ink-3)]">
          {advance ? `${confirmedCount} of ${totalCount} confirmed` : 'Not sent yet'}
        </div>
        <div className="w-full sm:w-[190px] shrink-0">
          {lastActivity ? (
            <LastUpdated stamp={lastActivity.stamp} label="Last activity" />
          ) : (
            <span className="text-[11.5px] text-[var(--color-ink-4)]">No activity yet</span>
          )}
        </div>
      </Link>

      {managerView && (
        <div className={cn('flex items-center gap-2 shrink-0', 'flex-wrap')}>
          <Button
            variant="outline"
            size="sm"
            leading={<Icon.Document size={12} />}
            onClick={onSend}
            disabled={!canSend}
            title={sendDisabledReason}
          >
            {advance ? 'Re-send updated rider' : 'Send rider to venue'}
          </Button>
          <Button
            variant={fullyConfirmed ? 'primary' : 'outline'}
            size="sm"
            leading={<Icon.Check size={12} />}
            disabled={!fullyConfirmed}
            title={fullyConfirmed ? undefined : 'Not all items confirmed yet'}
            onClick={onConfirm}
          >
            Mark show confirmed
          </Button>
        </div>
      )}
    </li>
  );
}
