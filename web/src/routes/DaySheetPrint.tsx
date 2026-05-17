import { Link, useParams } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { Chip } from '@/components/ui/Chip';
import { MockTag } from '@/components/provenance/MockTag';
import { SourceTag } from '@/components/provenance/SourceTag';
import { LastUpdated } from '@/components/LastUpdated';
import {
  fmtDate,
  fmtFullDate,
  dayTypeLabel,
  travelModeIcon,
  travelModeLabel,
} from '@/lib/format';
import {
  getDay,
  getScheduleItemsForDay,
  getTravelForDay,
  getHotelsForDay,
} from '@/data/mockTour';
import { getMockVenue } from '@/data/mockVenues';
import { cn } from '@/lib/cn';
import { getGeneratedAtLabel } from '@/lib/today';
import type { Day, ScheduleItem, Travel, Hotel } from '@/types';

/**
 * Print-optimized day sheet. Lives at `/print/daysheet/:date`, outside the
 * main Layout (no sidebar, no topbar), so the page is a clean sheet ready
 * for Cmd/Ctrl+P. On screen it shows an 8.5"-wide paper preview with an
 * action bar; in print the action bar is hidden and the sheet fills the
 * page.
 */
export function DaySheetPrint() {
  const { date } = useParams();
  const { tour, isDayLocked, getDayLastUpdated } = useApp();

  if (!date) return <NotFoundView />;
  const day = getDay(date);
  if (!day) return <NotFoundView />;

  const items = getScheduleItemsForDay(day.id).sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  const travel = getTravelForDay(day.id);
  const hotels = getHotelsForDay(day.id);
  const venue = getMockVenue(day.venueId);
  const dayIndex = tour.days.findIndex((d) => d.id === day.id);
  const pm = tour.riderImports[0]?.productionManager;
  const tm = tour.personnel.find((p) => p.role === 'Tour Manager');
  const locked = isDayLocked(day.id);

  return (
    <>
      {/* Action bar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-[var(--color-paper)] border-b border-[var(--color-rule)] px-5 py-2.5 flex items-center gap-3">
        <Link
          to={`/daysheet/${date}`}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
        >
          ← Back to day sheet
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-4)] hidden sm:inline">
          Print preview · letter
        </span>
        <DayJumper day={day} />
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-semibold rounded-[3px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
        >
          <Icon.Print size={13} /> Print / Save as PDF
        </button>
      </div>

      {/* Sheet area — centered on screen, full-bleed in print */}
      <div className="px-4 py-6 print:p-0 flex justify-center print:block">
        <article className="print-sheet bg-white text-[var(--color-ink)] shadow-[0_8px_28px_rgba(21,19,15,0.10)] print:shadow-none w-[8.5in] max-w-full print:w-full">
          {/* HEADER */}
          <header className="px-7 pt-6 pb-4 border-b-[2px] border-[var(--color-ink)] relative">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
                  {tour.artistName} · {tour.name}
                  <SourceTag source="rider_cover" field="Tour name" />
                </div>
                <h1 className="font-display text-[40px] leading-[0.95] font-bold tracking-[-0.025em] text-[var(--color-ink)] mt-1.5">
                  {fmtDate(day.date, 'EEEE, MMMM d, yyyy')}
                </h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-[15px] font-semibold text-[var(--color-ink-2)]">
                  <span>{day.city ?? '—'}</span>
                  {venue && (
                    <>
                      <span className="text-[var(--color-ink-4)]">·</span>
                      <span>{venue.name}</span>
                      <MockTag source="venue" field="Venue" />
                    </>
                  )}
                </div>
                <div className="mt-1.5">
                  <LastUpdated stamp={getDayLastUpdated(day)} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
                  Day Sheet
                </div>
                <div className="font-display text-[26px] leading-none font-bold tabular text-[var(--color-ink)] mt-1.5">
                  Day {dayIndex + 1} <span className="text-[var(--color-ink-3)] font-normal text-[18px]">/ {tour.days.length}</span>
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5 flex-wrap justify-end">
                  <Chip tone={day.dayType} size="sm">
                    {dayTypeLabel(day.dayType)}
                  </Chip>
                  {locked ? (
                    <Chip tone="neutral" size="sm" variant="outline">
                      <Icon.Lock size={9} /> Locked
                    </Chip>
                  ) : (
                    <Chip tone="neutral" size="sm" variant="outline">
                      Draft
                    </Chip>
                  )}
                </div>
              </div>
            </div>

            {/* Fact strip */}
            <div className="mt-4 pt-3 border-t border-[var(--color-rule-soft)] grid grid-cols-4 gap-3">
              <Fact label="Weather" value={day.weather ? `${day.weather.conditions} · ${day.weather.low}/${day.weather.high}°C` : 'TBD'} mockSource="day_weather" />
              <Fact label="Sun" value={day.sunrise && day.sunset ? `↑ ${day.sunrise}  ↓ ${day.sunset}` : 'TBD'} mockSource="day_weather" />
              <Fact label="Local" value={venue ? `${venue.language ?? '—'} · ${venue.currency ?? '—'}` : '—'} mockSource={venue ? 'venue' : undefined} />
              <Fact label="Power" value={venue?.voltage ?? '—'} mockSource={venue ? 'venue' : undefined} />
            </div>

            {/* Locked watermark — visible only in print */}
            {locked && (
              <div className="hidden print:block absolute right-7 top-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-ink-3)]">
                Locked · published
              </div>
            )}
          </header>

          {/* BODY GRID */}
          <div className="grid grid-cols-[1.55fr_1fr] gap-x-6 px-7 py-5">
            {/* LEFT: schedule + travel + notes */}
            <div className="space-y-5 min-w-0">
              <Section title="Schedule" count={items.length} sourceKey="schedule_item">
                {items.length === 0 ? (
                  <Empty>Nothing scheduled.</Empty>
                ) : (
                  <ol className="divide-y divide-[var(--color-rule-soft)]">
                    {items.map((it) => (
                      <ScheduleRow key={it.id} item={it} />
                    ))}
                  </ol>
                )}
              </Section>

              {travel.length > 0 && (
                <Section title="Travel" count={travel.length} sourceKey="travel">
                  <ul className="space-y-1.5">
                    {travel.map((t) => (
                      <TravelRow key={t.id} travel={t} />
                    ))}
                  </ul>
                </Section>
              )}

              {day.notes && (
                <Section title="Notes">
                  <p className="text-[12px] text-[var(--color-ink-2)] leading-relaxed">{day.notes}</p>
                </Section>
              )}
            </div>

            {/* RIGHT: venue + hotel + key contacts */}
            <div className="space-y-5 min-w-0 border-l border-[var(--color-rule-soft)] pl-5">
              {venue && (
                <Section title="Venue" sourceKey="venue">
                  <VenueBlock venue={venue} />
                </Section>
              )}

              {hotels.length > 0 && (
                <Section title="Lodging" count={hotels.length} sourceKey="hotel">
                  <ul className="space-y-3">
                    {hotels.map((h) => (
                      <HotelRow key={h.id} hotel={h} />
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="Key contacts">
                <ul className="text-[11.5px] space-y-2">
                  {pm?.name && (
                    <ContactRow
                      name={pm.name}
                      role="Production Manager"
                      phone={pm.phone}
                      email={pm.email}
                      sourceKey="rider_pm_contact"
                    />
                  )}
                  {tm && (
                    <ContactRow
                      name={tm.person.name}
                      role={tm.isPlaceholder ? 'Tour Manager (name TBD)' : 'Tour Manager'}
                      phone={tm.person.phone}
                      email={tm.person.email}
                      mockSource={tm.isPlaceholder ? 'tour_person' : undefined}
                    />
                  )}
                  {venue?.housePM && (
                    <ContactRow
                      name={venue.housePM}
                      role={`House PM · ${venue.name}`}
                      phone={venue.housePMPhone}
                      mockSource="venue"
                    />
                  )}
                  {venue?.promoterRep && (
                    <ContactRow
                      name={venue.promoterRep}
                      role={`Promoter · ${venue.promoter}`}
                      phone={venue.promoterPhone}
                      email={venue.promoterEmail}
                      mockSource="venue"
                    />
                  )}
                </ul>
              </Section>
            </div>
          </div>

          {/* CREW STRIP */}
          <div className="px-7 py-4 border-t border-[var(--color-ink)]">
            <div className="flex items-baseline justify-between mb-2 pb-1 border-b border-[var(--color-rule-soft)]">
              <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--color-ink)]">
                Crew · {tour.personnel.length} people on tour
              </h3>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
                ● confirmed · ○ pending
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-0.5 text-[11px]">
              {tour.personnel.map((m) => {
                const g = tour.groups.find((gr) => gr.id === m.groupId)!;
                return (
                  <div key={m.id} className="flex items-baseline gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: g.color }}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-mono w-3',
                        m.isPlaceholder ? 'text-[var(--color-ink-4)]' : 'text-[var(--color-ink-2)]',
                      )}
                      aria-hidden
                    >
                      {m.isPlaceholder ? '○' : '●'}
                    </span>
                    <span
                      className={cn(
                        'font-semibold truncate',
                        m.isPlaceholder && 'italic text-[var(--color-ink-3)]',
                      )}
                    >
                      {m.person.name}
                    </span>
                    <span className="text-[var(--color-ink-3)] truncate">· {m.role}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FOOTER */}
          <footer className="px-7 py-2.5 border-t-[2px] border-[var(--color-ink)] flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
            <span>
              {tour.artistName} · {tour.name}
            </span>
            <span>{fmtFullDate(day.date)}</span>
            <span>Generated {getGeneratedAtLabel()}</span>
          </footer>
        </article>
      </div>
    </>
  );
}

// ============================================================
// Sub-components
// ============================================================

function NotFoundView() {
  return (
    <div className="p-12 text-center">
      <h1 className="font-display text-[28px] font-bold">Day not found</h1>
      <p className="mt-2 text-[14px] text-[var(--color-ink-3)]">
        That date isn’t on this tour.{' '}
        <Link to="/daysheet" className="underline">
          Back to day sheets
        </Link>
        .
      </p>
    </div>
  );
}

function DayJumper({ day }: { day: Day }) {
  const { tour } = useApp();
  const idx = tour.days.findIndex((d) => d.id === day.id);
  const prev = idx > 0 ? tour.days[idx - 1] : undefined;
  const next = idx >= 0 && idx < tour.days.length - 1 ? tour.days[idx + 1] : undefined;

  return (
    <div className="hidden md:inline-flex items-center gap-1 ml-3 border-l border-[var(--color-rule)] pl-3">
      {prev ? (
        <Link
          to={`/print/daysheet/${prev.date}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          title={`Previous: ${fmtDate(prev.date, 'EEE, MMM d')}`}
        >
          <Icon.Chevron size={11} className="rotate-180" /> {fmtDate(prev.date, 'MMM d')}
        </Link>
      ) : (
        <span className="text-[11px] text-[var(--color-ink-5)]">—</span>
      )}
      <span className="text-[var(--color-ink-5)] mx-1">·</span>
      {next ? (
        <Link
          to={`/print/daysheet/${next.date}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          title={`Next: ${fmtDate(next.date, 'EEE, MMM d')}`}
        >
          {fmtDate(next.date, 'MMM d')} <Icon.Chevron size={11} />
        </Link>
      ) : (
        <span className="text-[11px] text-[var(--color-ink-5)]">—</span>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  sourceKey,
  children,
}: {
  title: string;
  count?: number;
  sourceKey?: Parameters<typeof MockTag>[0]['source'];
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-baseline justify-between mb-2 pb-1 border-b border-[var(--color-ink)]">
        <h3 className="font-display text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--color-ink)]">
          {title}
          {sourceKey && <MockTag source={sourceKey} field={title} />}
        </h3>
        {count !== undefined && (
          <span className="font-mono text-[10px] tabular text-[var(--color-ink-3)]">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  mockSource,
}: {
  label: string;
  value: string;
  mockSource?: Parameters<typeof MockTag>[0]['source'];
}) {
  return (
    <div>
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-3)] flex items-baseline gap-1">
        {label}
        {mockSource && <MockTag source={mockSource} field={label} />}
      </div>
      <div className="font-mono text-[11.5px] tabular text-[var(--color-ink)] mt-0.5 leading-tight">
        {value}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] text-[var(--color-ink-3)] italic">{children}</p>;
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  return (
    <li className="py-1.5 flex items-baseline gap-3 text-[12px]">
      <span className="font-mono tabular font-bold w-11 shrink-0 text-[var(--color-ink)]">
        {item.startTime}
      </span>
      <div className="flex-1 min-w-0">
        <div className="leading-snug">
          <span className="font-semibold text-[var(--color-ink)]">{item.title}</span>
          {item.sensitive && (
            <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.10em] text-[var(--color-accent)]">
              ⚠ sensitive
            </span>
          )}
        </div>
        {item.location && (
          <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5">{item.location}</div>
        )}
      </div>
      {item.endTime && (
        <span className="font-mono tabular text-[10.5px] text-[var(--color-ink-4)] shrink-0">
          → {item.endTime}
        </span>
      )}
    </li>
  );
}

function TravelRow({ travel }: { travel: Travel }) {
  return (
    <li className="border-b border-[var(--color-rule-soft)] pb-1.5 last:border-0 text-[12px]">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[13px] leading-none">{travelModeIcon(travel.mode)}</span>
        <span className="font-semibold">
          {travelModeLabel(travel.mode)} · {travel.carrier} {travel.identifier}
        </span>
        <span className="font-mono tabular text-[var(--color-ink-2)]">
          {travel.from} {travel.departTime} → {travel.to} {travel.arriveTime}
        </span>
        <span className="ml-auto text-[10.5px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-3)] tabular">
          {travel.passengers.length} pax
        </span>
      </div>
      {travel.recordLocator && (
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-4)] mt-0.5">
          PNR {travel.recordLocator}
        </div>
      )}
    </li>
  );
}

function VenueBlock({ venue }: { venue: ReturnType<typeof getMockVenue> & object }) {
  return (
    <div className="text-[12px] space-y-0.5">
      <div className="font-semibold text-[var(--color-ink)] leading-tight">{venue.name}</div>
      <div className="text-[var(--color-ink-2)] leading-snug">
        {venue.address}
        <br />
        {venue.city}, {venue.country}
      </div>
      {venue.phone && (
        <div className="font-mono tabular text-[var(--color-ink-2)] mt-0.5">
          <a href={`tel:${venue.phone.replace(/\s/g, '')}`} className="hover:underline">
            {venue.phone}
          </a>
        </div>
      )}
      {venue.stageDoor && (
        <div className="text-[10.5px] text-[var(--color-ink-3)] mt-1 leading-snug">
          <span className="font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
            Stage door:
          </span>{' '}
          {venue.stageDoor}
        </div>
      )}
      {venue.capacity && (
        <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)] mt-1">
          Capacity: {venue.capacity.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function HotelRow({ hotel }: { hotel: Hotel }) {
  return (
    <li className="text-[12px]">
      <div className="font-semibold text-[var(--color-ink)] leading-tight flex items-center gap-1">
        {hotel.name}
        {hotel.sensitive && (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
            ⚠ artist
          </span>
        )}
      </div>
      <div className="text-[var(--color-ink-2)] leading-snug">{hotel.address}</div>
      {hotel.phone && (
        <div className="font-mono tabular text-[var(--color-ink-2)]">
          <a href={`tel:${hotel.phone.replace(/\s/g, '')}`} className="hover:underline">
            {hotel.phone}
          </a>
        </div>
      )}
      <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)] mt-0.5">
        {hotel.occupants.length} occupants
        {hotel.checkIn && ` · check-in ${hotel.checkIn}`}
      </div>
    </li>
  );
}

function ContactRow({
  name,
  role,
  phone,
  email,
  sourceKey,
  mockSource,
}: {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  sourceKey?: Parameters<typeof SourceTag>[0]['source'];
  mockSource?: Parameters<typeof MockTag>[0]['source'];
}) {
  return (
    <li>
      <div className="font-semibold text-[var(--color-ink)] leading-tight flex items-baseline gap-1">
        {name}
        {sourceKey && <SourceTag source={sourceKey} field={name} />}
        {mockSource && <MockTag source={mockSource} field={name} />}
      </div>
      <div className="text-[10.5px] text-[var(--color-ink-3)] leading-tight">{role}</div>
      {phone && (
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className="font-mono tabular text-[var(--color-ink-2)] hover:underline block leading-tight"
        >
          {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="font-mono text-[10.5px] text-[var(--color-ink-3)] hover:underline block leading-tight"
        >
          {email}
        </a>
      )}
    </li>
  );
}
