import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockBadge } from '@/components/provenance/MockBadge';
import { MockTag } from '@/components/provenance/MockTag';
import { SourceTag } from '@/components/provenance/SourceTag';
import { SensitiveExplain } from '@/components/ExplainTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { LobbyCallLadder } from '@/components/LobbyCallLadder';
import { LastUpdated } from '@/components/LastUpdated';
import { getMockVenue } from '@/data/mockVenues';
import type { SourceKey } from '@/data/sources';
import type { RealSourceKey } from '@/data/realSources';
import type { Day, ScheduleItem, UpdateStamp } from '@/types';
import {
  fmtFullDate,
  fmtDate,
  dayTypeLabel,
  scheduleItemLabel,
  travelModeIcon,
  travelModeLabel,
} from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import {
  getDay,
  getScheduleItemsForDay,
  getTravelForDay,
  getHotelsForDay,
} from '@/data/mockTour';
import { MOCK_TODAY, getGeneratedAtLabel } from '@/lib/today';
import { cn } from '@/lib/cn';

type Mode = 'edit' | 'personal';

export function DaySheets() {
  const {
    tour,
    user,
    allUsers,
    userKey,
    setUserKey,
    isDayLocked,
    toggleDayLocked,
    getDayLastUpdated,
    densityMode,
  } = useApp();
  const { date } = useParams();
  const navigate = useNavigate();

  const defaultDate = useMemo(() => {
    if (date) return date;
    const demoDay = getDay(MOCK_TODAY);
    const firstShow = tour.days.find((d) => d.dayType === 'show');
    return demoDay?.date ?? firstShow?.date ?? tour.days[0]?.date ?? '';
  }, [date, tour.days]);

  const day = getDay(defaultDate);
  const [mode, setMode] = useState<Mode>('edit');
  const locked = day ? isDayLocked(day.id) : false;

  if (!day) {
    return (
      <div>
        <PageHeader title="Day sheets" />
        <EmptyState title="No days yet" hint="Add tour dates on the calendar to publish day sheets." />
      </div>
    );
  }

  const dayIndex = tour.days.findIndex((d) => d.id === day.id);
  const prevDay = dayIndex > 0 ? tour.days[dayIndex - 1] : undefined;
  const nextDay = dayIndex >= 0 && dayIndex < tour.days.length - 1 ? tour.days[dayIndex + 1] : undefined;

  return (
    <div>
      <PageHeader
        title="Day sheet"
        description="The sheet is the hero. Pro mode keeps publishing tools close; Simple mode keeps the readable sheet front and center."
        actions={
          <>
            <Link
              to={`/print/daysheet/${day.date}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]"
              title="Open print-ready day sheet in a new tab"
            >
              <Icon.Print size={14} /> Print / PDF
            </Link>
            <button
              type="button"
              onClick={() => toggleDayLocked(day.id)}
              className={cn(
                'min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] border transition-colors',
                locked
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/14'
                  : 'border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]',
              )}
              title={locked ? 'Locked - click to unlock and resume editing' : 'Lock the day - marks it closed-out / ready to publish'}
            >
              <Icon.Lock size={14} /> {locked ? 'Locked' : 'Lock day'}
            </button>
            <Button variant="primary" leading={<Icon.Sparkle size={14} />} className="min-h-11 md:min-h-9">
              Publish
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={day.dayType}>{dayTypeLabel(day.dayType)}</Chip>
            <Chip tone="neutral" variant="outline">{fmtFullDate(day.date)}</Chip>
            {day.city && <Chip tone="neutral" variant="outline">{day.city}</Chip>}
            {locked ? (
              <Chip tone="critical" variant="outline">
                <Icon.Lock size={10} /> Locked
              </Chip>
            ) : (
              <Chip tone="neutral" variant="outline">Draft</Chip>
            )}
            <ModeToggle mode={mode} setMode={setMode} />
            <MockBadge source="schedule_item" className="ml-auto hidden sm:inline-flex" />
          </div>
        }
      />

      <DateStepper
        day={day}
        prevDay={prevDay}
        nextDay={nextDay}
        days={tour.days}
        isDayLocked={isDayLocked}
        onSelect={(d) => navigate(`/daysheet/${d.date}`)}
      />

      <div className="lg:hidden mt-5">
        <MobileDaySheet day={day} mode={mode} nextDay={nextDay} />
      </div>

      <div
        className={cn(
          'hidden lg:grid gap-5 mt-5',
          densityMode === 'pro' ? 'lg:grid-cols-[260px_1fr]' : 'lg:grid-cols-1',
        )}
      >
        {densityMode === 'pro' && (
          <ToolsRail
            day={day}
            mode={mode}
            userKey={userKey}
            allUsers={allUsers}
            setUserKey={setUserKey}
            lastUpdated={getDayLastUpdated(day)}
          />
        )}
        <DaySheet day={day} mode={mode} />
      </div>

      <DataSourcesPanel
        sourceKeys={['schedule_item', 'travel', 'hotel', 'visibility', 'day_weather']}
        intro="The day sheet pulls together schedule, movement, lodging, and visibility. Source tags stay visible even when Simple mode tucks tools away."
      />
    </div>
  );
}

function DateStepper({
  day,
  prevDay,
  nextDay,
  days,
  isDayLocked,
  onSelect,
}: {
  day: Day;
  prevDay?: Day;
  nextDay?: Day;
  days: Day[];
  isDayLocked: (dayId: string) => boolean;
  onSelect: (day: Day) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="card p-2 flex items-center gap-2">
        <button
          type="button"
          disabled={!prevDay}
          onClick={() => prevDay && onSelect(prevDay)}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-[4px] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)] disabled:opacity-35"
          aria-label="Previous day"
        >
          <Icon.Chevron size={16} className="rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => onSelect(day)}
          className="flex-1 min-h-11 rounded-[4px] px-3 text-center hover:bg-[var(--color-paper-2)]"
        >
          <span className="block text-[14px] font-semibold text-[var(--color-ink)]">
            {fmtDate(day.date, 'EEE, MMM d')}
          </span>
          <span className="block text-[11.5px] text-[var(--color-ink-3)]">
            {day.city || dayTypeLabel(day.dayType)}
          </span>
        </button>
        <button
          type="button"
          disabled={!nextDay}
          onClick={() => nextDay && onSelect(nextDay)}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-[4px] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)] disabled:opacity-35"
          aria-label="Next day"
        >
          <Icon.Chevron size={16} />
        </button>
      </div>

      <details className="card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-[var(--color-ink)]">
          All dates
        </summary>
        <ul className="max-h-[280px] overflow-y-auto border-t border-[var(--color-rule-soft)]">
          {days.map((d) => {
            const selected = d.date === day.date;
            const locked = isDayLocked(d.id);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect(d)}
                  className={cn(
                    'w-full min-h-11 text-left px-4 py-2 flex items-center gap-2 hover:bg-[var(--color-paper)]/60 transition-colors',
                    selected && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(--color-day-${d.dayType})` }} />
                  <span className={cn('font-mono text-[11px] tabular w-16 shrink-0', selected ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink-3)]')}>
                    {fmtDate(d.date, 'EEE d')}
                  </span>
                  <span className="text-[12px] font-semibold flex-1 truncate">
                    {d.city || dayTypeLabel(d.dayType)}
                  </span>
                  {locked && (
                    <Icon.Lock
                      size={11}
                      className={cn('shrink-0', selected ? 'text-[var(--color-paper)]' : 'text-[var(--color-accent)]')}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

function ToolsRail({
  day,
  mode,
  userKey,
  allUsers,
  setUserKey,
  lastUpdated,
}: {
  day: Day;
  mode: Mode;
  userKey: string;
  allUsers: ReturnType<typeof useApp>['allUsers'];
  setUserKey: ReturnType<typeof useApp>['setUserKey'];
  lastUpdated?: UpdateStamp;
}) {
  return (
    <aside className="space-y-4">
      {mode === 'personal' && (
        <Card>
          <div className="eyebrow mb-2">Viewer</div>
          <p className="text-[11.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
            Personalized view filters by visibility for this person.
          </p>
          <select
            value={userKey}
            onChange={(e) => setUserKey(e.target.value as keyof typeof allUsers)}
            className="w-full h-9 px-2 text-[12.5px] font-semibold rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)]"
          >
            {Object.entries(allUsers).map(([k, u]) => (
              <option key={k} value={k}>
                {u.name} - {u.role}
              </option>
            ))}
          </select>
        </Card>
      )}

      <LobbyCallLadder day={day} />

      <Card>
        <div className="eyebrow mb-1.5">Revision</div>
        <div className="font-mono text-[11.5px] tabular text-[var(--color-ink-3)]">
          Rev 0 - Draft
        </div>
        <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
          Not yet published. Push notifications fire on publish.
        </div>
        {lastUpdated && (
          <div className="mt-2.5 pt-2.5 border-t border-[var(--color-rule-soft)]">
            <LastUpdated stamp={lastUpdated} />
          </div>
        )}
      </Card>
    </aside>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-[4px] border border-[var(--color-rule)] overflow-hidden bg-[var(--color-card)]">
      {(['edit', 'personal'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            'px-3 min-h-8 text-[11px] font-mono font-semibold uppercase tracking-[0.10em]',
            mode === m
              ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
              : 'text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)]',
          )}
        >
          {m === 'edit' ? 'Edit' : 'Personal'}
        </button>
      ))}
    </div>
  );
}

function MobileDaySheet({ day, mode, nextDay }: { day: Day; mode: Mode; nextDay?: Day }) {
  const { tour, user, getDayLastUpdated } = useApp();
  const allItems = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const allTravel = getTravelForDay(day.id);
  const allHotels = getHotelsForDay(day.id);
  const items = mode === 'edit' ? allItems : allItems.filter((it) => resolveVisibility(it.visibility, user) !== 'blocked');
  const travel = mode === 'edit' ? allTravel : allTravel.filter((t) => resolveVisibility(t.visibility, user) !== 'blocked');
  const hotels = mode === 'edit' ? allHotels : allHotels.filter((h) => resolveVisibility(h.visibility, user) !== 'blocked');
  const venue = getMockVenue(day.venueId);

  return (
    <article className="card overflow-hidden bg-[var(--color-card)]">
      <header className="p-5 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/55">
        <div className="eyebrow">{tour.artistName}</div>
        <h2 className="mt-1 font-display text-[34px] leading-[0.98] font-bold text-[var(--color-ink)]">
          {fmtDate(day.date, 'EEEE, MMMM d')}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={day.dayType}>{dayTypeLabel(day.dayType)}</Chip>
          {day.city && <Chip tone="neutral" variant="outline">{day.city}</Chip>}
          <MockTag source="tour_route" field="Mobile day sheet date / city" />
        </div>
        <div className="mt-2.5">
          <LastUpdated stamp={getDayLastUpdated(day)} />
        </div>
      </header>

      <div className="p-5 space-y-6">
        {venue && (
          <section>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">Venue</h3>
              <MockTag source="venue" field="Venue" />
            </div>
            <div className="mt-2 text-[16px] font-semibold text-[var(--color-ink)]">{venue.name}</div>
            <a
              href={mapsHref(`${venue.name}, ${venue.address}, ${venue.city}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-[13px] leading-snug text-[var(--color-ocean)] underline decoration-[var(--color-ocean)]/30"
            >
              {venue.address}, {venue.city}
            </a>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={mapsHref(`${venue.name}, ${venue.address}, ${venue.city}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] text-[13px] font-semibold"
              >
                <Icon.MapPin size={14} /> Maps
              </a>
              {venue.phone && (
                <a
                  href={telHref(venue.phone)}
                  className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] text-[13px] font-semibold"
                >
                  <Icon.Phone size={14} /> Call
                </a>
              )}
            </div>
          </section>
        )}

        <SheetSection title={mode === 'edit' ? 'Show clock' : 'Your day'} eyebrow={`${items.length} items`} mockSource="schedule_item">
          {items.length === 0 ? (
            <p className="text-[13px] text-[var(--color-ink-3)]">Nothing visible for this viewer.</p>
          ) : (
            <ol className="divide-y divide-[var(--color-rule-soft)]">
              {items.map((it) => (
                <li key={it.id} className="py-3 grid grid-cols-[58px_1fr] gap-3">
                  <span className="font-mono text-[16px] tabular font-semibold text-[var(--color-ink)]">{it.startTime}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-[var(--color-ink)]">{it.title}</span>
                    <span className="mt-1 flex items-center gap-2 flex-wrap">
                      <Chip tone="neutral" size="sm">{scheduleItemLabel(it.type)}</Chip>
                      {it.location && <span className="text-[12.5px] text-[var(--color-ink-3)]">{it.location}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SheetSection>

        {travel.length > 0 && (
          <SheetSection title="Travel" eyebrow={`${travel.length} segment${travel.length === 1 ? '' : 's'}`} mockSource="travel">
            <ul className="space-y-3">
              {travel.map((t) => (
                <li key={t.id} className="text-[13px]">
                  <span className="font-mono text-[15px] text-[var(--color-day-travel)]">{travelModeIcon(t.mode)}</span>{' '}
                  <span className="font-semibold">{travelModeLabel(t.mode)}</span> {t.from} {t.departTime} - {t.to} {t.arriveTime}
                </li>
              ))}
            </ul>
          </SheetSection>
        )}

        {hotels.length > 0 && (
          <SheetSection title="Lodging" eyebrow={`${hotels.length} block`} mockSource="hotel">
            <ul className="space-y-3">
              {hotels.map((h) => (
                <li key={h.id}>
                  <div className="text-[13px] font-semibold">{h.name}</div>
                  <a
                    href={mapsHref(h.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12.5px] text-[var(--color-ocean)] underline decoration-[var(--color-ocean)]/30"
                  >
                    {h.address}
                  </a>
                  {h.phone && (
                    <div className="mt-1 flex gap-2">
                      <a href={telHref(h.phone)} className="min-h-11 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] px-3 text-[12.5px] font-semibold">
                        <Icon.Phone size={13} /> Call
                      </a>
                      <a href={whatsAppHref(h.phone)} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--color-rule)] px-3 text-[12.5px] font-semibold">
                        <Icon.Message size={13} /> WhatsApp
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SheetSection>
        )}

        {venue && (venue.housePM || venue.promoterRep) && (
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">Contacts</h3>
              <MockTag source="venue" field="Promoter contacts" />
            </div>
            <div className="space-y-3">
              {venue.housePM && <MobileContact label="House PM" name={venue.housePM} phone={venue.housePMPhone} />}
              {venue.promoterRep && <MobileContact label={venue.promoter ?? 'Promoter'} name={venue.promoterRep} phone={venue.promoterPhone} />}
            </div>
          </section>
        )}

        {nextDay && (
          <section className="border-t border-[var(--color-rule-soft)] pt-5">
            <div className="eyebrow mb-2">Tomorrow</div>
            <Link to={`/daysheet/${nextDay.date}`} className="min-h-11 flex items-center justify-between gap-3 rounded-[4px] border border-[var(--color-rule)] px-3 py-2">
              <span>
                <span className="block text-[13px] font-semibold">{fmtDate(nextDay.date, 'EEE, MMM d')}</span>
                <span className="block text-[12px] text-[var(--color-ink-3)]">{nextDay.city || dayTypeLabel(nextDay.dayType)}</span>
              </span>
              <Icon.Chevron size={14} />
            </Link>
          </section>
        )}
      </div>
    </article>
  );
}

function MobileContact({ label, name, phone }: { label: string; name: string; phone?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[var(--color-rule-soft)] pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">{label}</div>
        <div className="mt-0.5 text-[13px] font-semibold text-[var(--color-ink)]">{name}</div>
        {phone && <div className="font-mono text-[11px] tabular text-[var(--color-ink-3)]">{phone}</div>}
      </div>
      {phone && (
        <span className="flex shrink-0 gap-1">
          <a href={telHref(phone)} className="h-11 w-11 inline-flex items-center justify-center rounded-[4px] border border-[var(--color-rule)]" aria-label={`Call ${name}`}>
            <Icon.Phone size={14} />
          </a>
          <a href={whatsAppHref(phone)} target="_blank" rel="noopener noreferrer" className="h-11 w-11 inline-flex items-center justify-center rounded-[4px] border border-[var(--color-rule)]" aria-label={`WhatsApp ${name}`}>
            <Icon.Message size={14} />
          </a>
        </span>
      )}
    </div>
  );
}

function DaySheet({ day, mode }: { day: Day; mode: Mode }) {
  const { tour, user, getDayLastUpdated } = useApp();
  const allItems = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const allTravel = getTravelForDay(day.id);
  const allHotels = getHotelsForDay(day.id);

  const items = mode === 'edit' ? allItems : allItems.filter((it) => resolveVisibility(it.visibility, user) !== 'blocked');
  const travel = mode === 'edit' ? allTravel : allTravel.filter((t) => resolveVisibility(t.visibility, user) !== 'blocked');
  const hotels = mode === 'edit' ? allHotels : allHotels.filter((h) => resolveVisibility(h.visibility, user) !== 'blocked');

  return (
    <article className="bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[4px] overflow-hidden shadow-[0_1px_0_rgba(21,19,15,0.04)]">
      <header className="px-8 pt-7 pb-5 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/60 relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="eyebrow">{tour.artistName} - {tour.name}</div>
            <h2 className="font-display text-[42px] leading-[0.95] font-bold text-[var(--color-ink)] mt-1.5">
              {fmtDate(day.date, 'EEEE, MMMM d')}
            </h2>
            <div className="mt-1 text-[14px] font-semibold text-[var(--color-ink-2)]">
              {day.city ?? '-'} - {dayTypeLabel(day.dayType)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="eyebrow">Day sheet</div>
            <div className="font-display text-[28px] leading-none font-bold tabular text-[var(--color-ink)]">
              {fmtDate(day.date, 'MM.dd')}
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              {mode === 'edit' ? 'Edit view' : `For: ${user.name}`}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--color-rule-soft)]">
          <Fact label="Tour day" value={`${tour.days.findIndex((d) => d.id === day.id) + 1} / ${tour.days.length}`} />
          {day.weather && <Fact label="Weather" value={`${day.weather.conditions} - ${day.weather.low}/${day.weather.high}C`} />}
          {day.sunrise && <Fact label="Sun" value={`${day.sunrise} / ${day.sunset}`} />}
          <Fact label="Items visible" value={`${items.length} sched - ${travel.length} travel - ${hotels.length} hotel`} />
        </div>

        <div className="mt-4">
          <LastUpdated stamp={getDayLastUpdated(day)} />
        </div>
      </header>

      <div className="px-8 py-6 space-y-7">
        <SheetSection
          title="Show clock"
          eyebrow={`${items.length} items`}
          mockSource="schedule_item"
          mockNote="Every time shown here is mock. Load-in, soundcheck, doors, set, curfew, and load-out are negotiated with the venue PM during advance. Some constraints, like soundcheck being 6h after load-in, are real rider rules."
        >
          {items.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)]">Nothing scheduled.</p>
          ) : (
            <ol className="divide-y divide-[var(--color-rule-soft)]">
              {items.map((it) => {
                const lvl = resolveVisibility(it.visibility, user);
                const hiddenForUser = lvl === 'blocked';
                const ruleKey = realRuleFor(it);
                return (
                  <li key={it.id} className="py-2.5 flex items-baseline gap-4">
                    <span className="font-mono text-[14px] tabular font-semibold w-16 shrink-0 text-[var(--color-ink)]">
                      {it.startTime}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-[var(--color-ink)] inline-flex items-baseline gap-1">
                          {it.title}
                          {ruleKey && <SourceTag source={ruleKey} field={`${it.title} - rule source`} />}
                        </span>
                        <Chip tone="neutral" size="sm">{scheduleItemLabel(it.type)}</Chip>
                        {mode === 'edit' && it.sensitive && (
                          <span className="inline-flex items-center">
                            <Chip tone="critical" size="sm">
                              <Icon.Lock size={9} /> Sensitive
                            </Chip>
                            <SensitiveExplain />
                          </span>
                        )}
                        {mode === 'edit' && hiddenForUser && (
                          <Chip tone="off" size="sm">
                            Hidden for {user.name.split(' ')[0]}
                          </Chip>
                        )}
                      </div>
                      {it.location && <div className="text-[12px] text-[var(--color-ink-3)] mt-0.5">{it.location}</div>}
                    </div>
                    {it.endTime && (
                      <span className="font-mono text-[11.5px] tabular text-[var(--color-ink-4)] shrink-0">
                        to {it.endTime}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </SheetSection>

        {travel.length > 0 && (
          <SheetSection
            title="Travel"
            eyebrow={`${travel.length} segment${travel.length === 1 ? '' : 's'}`}
            mockSource="travel"
            mockNote="Flight and bus segments are mock placeholders. Production data would come from travel-agent confirmations."
          >
            <ul className="space-y-3">
              {travel.map((t) => (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto] gap-3 items-baseline">
                  <span className="font-mono text-[16px] leading-none" style={{ color: 'var(--color-day-travel)' }}>
                    {travelModeIcon(t.mode)}
                  </span>
                  <div>
                    <div className="text-[13px] font-semibold">
                      {travelModeLabel(t.mode)} - {t.carrier} {t.identifier}
                    </div>
                    <div className="font-mono text-[12.5px] tabular text-[var(--color-ink-2)]">
                      {t.from} {t.departTime} - {t.to} {t.arriveTime}
                    </div>
                    {t.recordLocator && (
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-4)] mt-0.5">
                        PNR {t.recordLocator}
                      </div>
                    )}
                  </div>
                  <span className="text-[11.5px] text-[var(--color-ink-3)] tabular">
                    {t.passengers.length} pax
                  </span>
                </li>
              ))}
            </ul>
          </SheetSection>
        )}

        {hotels.length > 0 && (
          <SheetSection
            title="Lodging"
            eyebrow={`${hotels.length} block`}
            mockSource="hotel"
            mockNote="Hotel names, addresses, and check-in times are mock. The rider states rooming requirements, but the actual hotel comes from travel advance."
          >
            <ul className="space-y-3">
              {hotels.map((h) => (
                <li key={h.id} className="flex items-start gap-3">
                  <Icon.Home size={14} className="mt-0.5 text-[var(--color-ink-3)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{h.name}</span>
                      {h.sensitive && (
                        <span className="inline-flex items-center">
                          <Chip tone="critical" size="sm">
                            <Icon.Lock size={9} /> Hidden in print
                          </Chip>
                          <SensitiveExplain />
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[var(--color-ink-3)]">{h.address}</div>
                    <div className="text-[11px] text-[var(--color-ink-4)] mt-0.5 tabular">
                      {h.occupants.length} occupants
                      {h.checkIn && ` - check-in ${h.checkIn}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SheetSection>
        )}

        {mode === 'edit' && (
          <SheetSection title="Crew on duty" eyebrow={`${tour.personnel.length} people on tour`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[12.5px]">
              {tour.personnel.map((m) => {
                const g = tour.groups.find((gr) => gr.id === m.groupId)!;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />
                      <span className="font-semibold text-[var(--color-ink)] truncate">{m.person.name}</span>
                    </div>
                    <span className="text-[var(--color-ink-3)] truncate">{m.role}</span>
                  </div>
                );
              })}
            </div>
          </SheetSection>
        )}
      </div>

      <footer className="px-8 py-4 border-t border-[var(--color-rule)] bg-[var(--color-paper)]/50 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-4)] flex items-center justify-between">
        <span>{tour.artistName} - {tour.name} - {fmtDate(day.date, 'MMM d, yyyy')}</span>
        <span>Generated {getGeneratedAtLabel()}</span>
      </footer>
    </article>
  );
}

function SheetSection({
  title,
  eyebrow,
  children,
  mockSource,
  mockNote,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  mockSource?: SourceKey;
  mockNote?: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-[var(--color-rule-soft)]">
        <h3 className="font-display text-[18px] font-bold text-[var(--color-ink)] inline-flex items-baseline gap-1">
          {title}
          {mockSource && <MockTag source={mockSource} field={title} note={mockNote} />}
        </h3>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      </div>
      {children}
    </section>
  );
}

function realRuleFor(it: ScheduleItem): RealSourceKey | undefined {
  if (it.type === 'soundcheck') return 'rider_soundcheck';
  return undefined;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-mono text-[12.5px] tabular text-[var(--color-ink)] mt-1">{value}</div>
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
