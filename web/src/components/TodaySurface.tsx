import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '@/state/AppState';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { MockTag } from '@/components/provenance/MockTag';
import { SourceTag } from '@/components/provenance/SourceTag';
import { LastUpdated } from '@/components/LastUpdated';
import { getMockVenue } from '@/data/mockVenues';
import { getTodayIso, getNowIso } from '@/lib/today';
import { cn } from '@/lib/cn';
import {
  dayTypeLabel,
  fmtDate,
  travelModeIcon,
  travelModeLabel,
} from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';

export function TodaySurface({ className }: { className?: string }) {
  const {
    tour,
    user,
    isDayLocked,
    toggleDayLocked,
    getDayLastUpdated,
    getDay,
    getScheduleItemsForDay,
    getTravelForDay,
    getHotelsForDay,
  } = useApp();
  const day = getDay(getTodayIso());

  if (!day) return null;

  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const venue = getMockVenue(day.venueId);
  const locked = isDayLocked(day.id);
  const allSchedule = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const visibleSchedule = managerView
    ? allSchedule
    : allSchedule.filter((it) => resolveVisibility(it.visibility, user) !== 'blocked');
  const scheduleToShow = visibleSchedule;
  const currentClock = getNowIso().slice(11, 16);
  const nextItem = visibleSchedule.find((it) => it.startTime >= currentClock) ?? visibleSchedule[0];
  const travel = getTravelForDay(day.id).filter((t) => managerView || resolveVisibility(t.visibility, user) !== 'blocked');
  const hotels = getHotelsForDay(day.id).filter((h) => managerView || resolveVisibility(h.visibility, user) !== 'blocked');
  const unpublishedToday = !day.published;

  return (
    <section className={cn('card overflow-hidden bg-[var(--color-card)]', className)}>
      <div className="grid lg:grid-cols-[1.35fr_0.85fr]">
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="eyebrow">Today</div>
              <h2 className="mt-2 font-display text-[34px] sm:text-[46px] leading-[0.95] font-bold text-[var(--color-ink)]">
                {fmtDate(day.date, 'EEEE, MMMM d')}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-ink-2)]">
                <Chip tone={day.dayType}>{dayTypeLabel(day.dayType)}</Chip>
                {day.city && (
                  <span className="inline-flex items-baseline gap-1 font-semibold">
                    {day.city}
                    <MockTag source="tour_route" field="Today city" />
                  </span>
                )}
                {venue && (
                  <span className="inline-flex items-baseline gap-1 text-[var(--color-ink-3)]">
                    {venue.name}
                    <MockTag source="venue" field="Venue" />
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <LastUpdated stamp={getDayLastUpdated(day)} />
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2">
              <Link
                to={`/daysheet/${day.date}`}
                className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
              >
                <Icon.Document size={14} /> Day sheet
              </Link>
              {managerView && (
                <button
                  type="button"
                  onClick={() => toggleDayLocked(day.id)}
                  className={cn(
                    'min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] border transition-colors',
                    locked
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8 text-[var(--color-accent)]'
                      : 'border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]',
                  )}
                >
                  <Icon.Lock size={14} /> {locked ? 'Locked' : 'Lock day'}
                </button>
              )}
            </div>
          </div>

          {managerView && (
            <div className="mt-5">
              <AttentionLink
                to={`/daysheet/${day.date}`}
                icon={<Icon.Document size={14} />}
                label={unpublishedToday ? 'Sheet not published' : 'Sheet published'}
                hint={unpublishedToday ? 'Review today' : 'Ready'}
                active={unpublishedToday}
              />
            </div>
          )}

          <div className="mt-6 border-t border-[var(--color-rule-soft)] pt-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)] inline-flex items-baseline gap-1">
                {managerView ? 'Show clock' : 'Your call times'}
                <MockTag source="schedule_item" field="Today schedule" />
              </h3>
              {nextItem && (
                <span className="text-[11px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
                  Next: {nextItem.startTime}
                </span>
              )}
            </div>

            {scheduleToShow.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-3)]">Nothing visible for this viewer yet.</p>
            ) : (
              <ol className="divide-y divide-[var(--color-rule-soft)]">
                {scheduleToShow.map((it) => {
                  const level = resolveVisibility(it.visibility, user);
                  return (
                    <li key={it.id} className="py-3 grid grid-cols-[56px_1fr] gap-3">
                      <span className="font-mono text-[15px] tabular font-semibold text-[var(--color-ink)]">
                        {it.startTime}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">{it.title}</span>
                        </span>
                        {it.location && (
                          <span className="mt-0.5 block text-[12px] text-[var(--color-ink-3)]">{it.location}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <aside className="border-t lg:border-t-0 lg:border-l border-[var(--color-rule)] bg-[var(--color-paper)]/45 p-5 sm:p-6 space-y-5">
          <VenuePanel venue={venue} dayCity={day.city} />

          {(travel.length > 0 || hotels.length > 0) && (
            <div className="border-t border-[var(--color-rule-soft)] pt-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Movement</h3>
                {tour.flightImports.some((f) => f.status === 'imported')
                  ? <SourceTag source="flight_confirmation" field="Travel and lodging" />
                  : <MockTag source="travel" field="Travel and lodging" />}
              </div>
              {travel.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {travel.map((t) => (
                    <li key={t.id} className="text-[12.5px] text-[var(--color-ink-2)]">
                      <span className="font-mono text-[13px] text-[var(--color-day-travel)]">{travelModeIcon(t.mode)}</span>{' '}
                      <span className="font-semibold">{travelModeLabel(t.mode)}</span> {t.from} {t.departTime} - {t.to} {t.arriveTime}
                    </li>
                  ))}
                </ul>
              )}
              {hotels.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {hotels.map((h) => (
                    <li key={h.id} className="text-[12.5px] text-[var(--color-ink-2)]">
                      <span className="font-semibold">{h.name}</span>
                      <span className="block text-[12px] text-[var(--color-ink-3)]">{h.address}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="border-t border-[var(--color-rule-soft)] pt-5">
            <div className="eyebrow mb-2">Viewing as</div>
            <div className="text-[13px] font-semibold text-[var(--color-ink)]">{user.name}</div>
            <div className="text-[12px] text-[var(--color-ink-3)]">{user.role}</div>
            {!managerView && (
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-ink-3)]">
                This view is filtered to what your role can see today.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AttentionLink({
  to,
  icon,
  label,
  hint,
  active,
  sourceTag = false,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  hint: string;
  active: boolean;
  sourceTag?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'min-h-[76px] rounded-[4px] border px-3 py-2.5 flex items-start gap-2 transition-colors',
        active
          ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/7 text-[var(--color-accent)]'
          : 'border-[var(--color-rule-soft)] bg-[var(--color-paper)]/45 text-[var(--color-ink-3)]',
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-[var(--color-ink)]">
          {label}
          {sourceTag && <SourceTag source="rider_conflicts_derived" field="Rider conflicts" />}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-[var(--color-ink-3)]">{hint}</span>
      </span>
    </Link>
  );
}

function VenuePanel({
  venue,
  dayCity,
}: {
  venue: ReturnType<typeof getMockVenue>;
  dayCity?: string;
}) {
  if (!venue) {
    return (
      <div>
        <div className="eyebrow">Venue</div>
        <p className="mt-2 text-[12.5px] text-[var(--color-ink-3)]">No venue attached yet.</p>
      </div>
    );
  }

  const mapHref = mapsHref(`${venue.name}, ${venue.address}, ${venue.city}`);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Venue</div>
        <MockTag source="venue" field="Venue directory" />
      </div>
      <div className="mt-2 text-[16px] font-semibold text-[var(--color-ink)]">{venue.name}</div>
      <div className="text-[12.5px] text-[var(--color-ink-3)] leading-snug">
        {venue.address}
        {dayCity ? `, ${dayCity}` : ''}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[12.5px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink-4)]"
        >
          <Icon.MapPin size={13} /> Maps
        </a>
        {venue.phone && (
          <a
            href={telHref(venue.phone)}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[12.5px] font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink-4)]"
          >
            <Icon.Phone size={13} /> Call
          </a>
        )}
      </div>

      {(venue.housePM || venue.promoterRep) && (
        <div className="mt-5 space-y-3 text-[12.5px]">
          {venue.housePM && (
            <ContactLine label="House PM" name={venue.housePM} phone={venue.housePMPhone} />
          )}
          {venue.promoterRep && (
            <ContactLine label={venue.promoter ?? 'Promoter'} name={venue.promoterRep} phone={venue.promoterPhone} />
          )}
        </div>
      )}
    </div>
  );
}

function ContactLine({ label, name, phone }: { label: string; name: string; phone?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[var(--color-rule-soft)] pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">{label}</div>
        <div className="mt-0.5 font-semibold text-[var(--color-ink)]">{name}</div>
        {phone && <div className="font-mono text-[11px] tabular text-[var(--color-ink-3)]">{phone}</div>}
      </div>
      {phone && (
        <span className="flex shrink-0 gap-1">
          <a
            href={telHref(phone)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] hover:border-[var(--color-ink-4)]"
            aria-label={`Call ${name}`}
          >
            <Icon.Phone size={13} />
          </a>
          <a
            href={whatsAppHref(phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 inline-flex items-center justify-center rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] hover:border-[var(--color-ink-4)]"
            aria-label={`WhatsApp ${name}`}
          >
            <Icon.Message size={13} />
          </a>
        </span>
      )}
    </div>
  );
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function whatsAppHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

function mapsHref(query: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}
