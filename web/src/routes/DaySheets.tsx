import { useMemo, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { buildShareUrl } from '@/lib/shareToken';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EditableText, EditableSelect } from '@/components/ui/EditableText';
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
import type { Day, ScheduleItem, ScheduleItemType, ScheduleItemPatch, ScheduleItemEditRecord, UpdateStamp, DayLockRecord, CurrentUser } from '@/types';
import { isValidHHMM } from '@/lib/time';
import {
  fmtFullDate,
  fmtDate,
  dayTypeLabel,
  scheduleItemLabel,
  travelModeIcon,
  travelModeLabel,
} from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import { MOCK_TODAY, getGeneratedAtLabel } from '@/lib/today';
import { cn } from '@/lib/cn';

type Mode = 'edit' | 'personal';

export function DaySheets() {
  const {
    tour,
    user,
    userKey,
    allUsers,
    isDayLocked,
    toggleDayLocked,
    getDayLockHistory,
    getDayLastUpdated,
    getDay,
    getScheduleItemsForDay,
    getTravelForDay,
    getHotelsForDay,
  } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';

  const [previewUserKey, setPreviewUserKey] = useState(userKey);

  const { date } = useParams();
  const navigate = useNavigate();

  const defaultDate = useMemo(() => {
    if (date) return date;
    const demoDay = getDay(MOCK_TODAY);
    const firstShow = tour.days.find((d) => d.dayType === 'show');
    return demoDay?.date ?? firstShow?.date ?? tour.days[0]?.date ?? '';
  }, [date, tour.days]);

  const day = getDay(defaultDate);
  const [mode, setMode] = useState<Mode>('personal');
  const [lockReason, setLockReason] = useState('');
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [showLockHistory, setShowLockHistory] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const handleCopyShareLink = useCallback(() => {
    if (!day) return;
    navigator.clipboard.writeText(buildShareUrl(day.date)).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    });
  }, [day]);
  const effectiveMode: Mode = managerView ? mode : 'personal';
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
        description="The sheet is the hero. Switch to Edit to change call times and items; Personal previews the sheet as any crew member sees it."
        actions={
          <>
            <button
              type="button"
              onClick={handleCopyShareLink}
              title="Copy shareable link to this day sheet"
              className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]"
            >
              <Icon.Share size={14} /> {copiedShare ? 'Copied!' : 'Share'}
            </button>
            <Link
              to={`/print/daysheet/${day.date}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)]"
              title="Open print-ready day sheet in a new tab"
            >
              <Icon.Print size={14} /> Print / PDF
            </Link>
            {managerView && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (locked) {
                      toggleDayLocked(day.id);
                    } else {
                      setShowLockPrompt((v) => !v);
                    }
                  }}
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
                {showLockPrompt && !locked && (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      placeholder="Reason (optional)"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          toggleDayLocked(day.id, lockReason.trim() || undefined);
                          setLockReason('');
                          setShowLockPrompt(false);
                        }
                      }}
                      className="h-9 w-44 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)]"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      leading={<Icon.Lock size={12} />}
                      onClick={() => {
                        toggleDayLocked(day.id, lockReason.trim() || undefined);
                        setLockReason('');
                        setShowLockPrompt(false);
                      }}
                    >
                      Lock
                    </Button>
                  </span>
                )}
              </div>
            )}
            {managerView && (
              <Button variant="primary" leading={<Icon.Sparkle size={14} />} className="min-h-11 md:min-h-9">
                Publish
              </Button>
            )}
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
            {managerView && getDayLockHistory(day.id).length > 0 && (
              <button
                type="button"
                onClick={() => setShowLockHistory((v) => !v)}
                className="text-[11.5px] font-semibold text-[var(--color-ink-3)] underline decoration-[var(--color-ink-4)]/40 hover:text-[var(--color-ink)]"
              >
                {getDayLockHistory(day.id).length} lock event{getDayLockHistory(day.id).length === 1 ? '' : 's'}
              </button>
            )}
            {managerView && <ModeToggle mode={mode} setMode={setMode} />}
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

      {managerView && showLockHistory && (
        <LockHistory records={getDayLockHistory(day.id)} />
      )}

      <div className="lg:hidden mt-5">
        <MobileDaySheet
          day={day}
          mode={effectiveMode}
          nextDay={nextDay}
          viewAsUser={managerView && effectiveMode === 'personal' ? allUsers[previewUserKey] ?? user : undefined}
        />
      </div>

      <div className="hidden lg:grid gap-5 mt-5 lg:grid-cols-[260px_1fr]">
        <ToolsRail
          day={day}
          mode={effectiveMode}
          managerView={managerView}
          previewUserKey={previewUserKey}
          allUsers={allUsers}
          setPreviewUserKey={setPreviewUserKey}
          lastUpdated={getDayLastUpdated(day)}
        />
        <DaySheet
          day={day}
          mode={effectiveMode}
          viewAsUser={managerView && effectiveMode === 'personal' ? allUsers[previewUserKey] ?? user : undefined}
        />
      </div>

      <DataSourcesPanel
        sourceKeys={['schedule_item', 'travel', 'hotel', 'visibility', 'day_weather']}
        intro="The day sheet pulls together schedule, movement, lodging, and visibility. Source tags stay visible throughout."
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

function LockHistory({ records }: { records: DayLockRecord[] }) {
  return (
    <div className="card mt-3 p-4">
      <div className="eyebrow mb-2">Lock history</div>
      <ol className="divide-y divide-[var(--color-rule-soft)]">
        {[...records].reverse().map((r, i) => (
          <li key={i} className="py-2 flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 shrink-0',
                r.locked ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-3)]',
              )}
            >
              {r.locked ? <Icon.Lock size={13} /> : <Icon.Check size={13} />}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[var(--color-ink)]">
                {r.locked ? 'Locked' : 'Unlocked'} by {r.stamp.by}
              </div>
              <div className="font-mono text-[11px] tabular text-[var(--color-ink-3)]">
                {fmtDate(r.stamp.at, 'MMM d, yyyy')} · {fmtDate(r.stamp.at, 'h:mm a')}
              </div>
              {r.reason && (
                <div className="text-[12px] text-[var(--color-ink-2)] mt-0.5 italic">{r.reason}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ToolsRail({
  day,
  mode,
  managerView,
  previewUserKey,
  allUsers,
  setPreviewUserKey,
  lastUpdated,
}: {
  day: Day;
  mode: Mode;
  managerView: boolean;
  previewUserKey: string;
  allUsers: ReturnType<typeof useApp>['allUsers'];
  setPreviewUserKey: (k: string) => void;
  lastUpdated?: UpdateStamp;
}) {
  return (
    <aside className="space-y-4">
      {mode === 'personal' && managerView && (
        <Card>
          <div className="eyebrow mb-2">Preview as</div>
          <p className="text-[11.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
            See the sheet as any crew member would — you stay signed in as manager.
          </p>
          <select
            value={previewUserKey}
            onChange={(e) => setPreviewUserKey(e.target.value)}
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

function MobileDaySheet({ day, mode, nextDay, viewAsUser }: { day: Day; mode: Mode; nextDay?: Day; viewAsUser?: CurrentUser }) {
  const {
    tour,
    user,
    getDayLastUpdated,
    getScheduleItemsForDay,
    getTravelForDay,
    getHotelsForDay,
  } = useApp();
  const effectiveUser = viewAsUser ?? user;
  const allItems = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const allTravel = getTravelForDay(day.id);
  const allHotels = getHotelsForDay(day.id);
  const items = mode === 'edit' ? allItems : allItems.filter((it) => resolveVisibility(it.visibility, effectiveUser) !== 'blocked');
  const travel = mode === 'edit' ? allTravel : allTravel.filter((t) => resolveVisibility(t.visibility, effectiveUser) !== 'blocked');
  const hotels = mode === 'edit' ? allHotels : allHotels.filter((h) => resolveVisibility(h.visibility, effectiveUser) !== 'blocked');
  const venue = getMockVenue(day.venueId);
  const flightsImported = tour.flightImports.some((f) => f.status === 'imported');
  const hotelsImported = tour.hotelImport != null;

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
          {mode === 'edit' ? (
            <ScheduleEditor day={day} items={items} />
          ) : items.length === 0 ? (
            <p className="text-[13px] text-[var(--color-ink-3)]">Nothing visible for this viewer.</p>
          ) : (
            <ol className="divide-y divide-[var(--color-rule-soft)]">
              {items.map((it) => (
                <li key={it.id} className="py-3 grid grid-cols-[58px_1fr] gap-3">
                  <span className="font-mono text-[16px] tabular font-semibold text-[var(--color-ink)]">{it.startTime}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-[var(--color-ink)]">{it.title}</span>
                    {it.location && (
                      <span className="mt-1 block text-[12.5px] text-[var(--color-ink-3)]">{it.location}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SheetSection>

        {travel.length > 0 && (
          <SheetSection title="Travel" eyebrow={`${travel.length} segment${travel.length === 1 ? '' : 's'}`} mockSource={flightsImported ? undefined : 'travel'} realSource={flightsImported ? 'flight_confirmation' : undefined}>
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
          <SheetSection title="Lodging" eyebrow={`${hotels.length} block`} mockSource={hotelsImported ? undefined : 'hotel'} realSource={hotelsImported ? 'hotel_confirmation' : undefined}>
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

function DaySheet({ day, mode, viewAsUser }: { day: Day; mode: Mode; viewAsUser?: CurrentUser }) {
  const {
    tour,
    user,
    getDayLastUpdated,
    getScheduleItemsForDay,
    getTravelForDay,
    getHotelsForDay,
  } = useApp();
  const effectiveUser = viewAsUser ?? user;
  const venue = getMockVenue(day.venueId);
  const allItems = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const allTravel = getTravelForDay(day.id);
  const allHotels = getHotelsForDay(day.id);

  const items = mode === 'edit' ? allItems : allItems.filter((it) => resolveVisibility(it.visibility, effectiveUser) !== 'blocked');
  const travel = mode === 'edit' ? allTravel : allTravel.filter((t) => resolveVisibility(t.visibility, effectiveUser) !== 'blocked');
  const hotels = mode === 'edit' ? allHotels : allHotels.filter((h) => resolveVisibility(h.visibility, effectiveUser) !== 'blocked');
  const flightsImported = tour.flightImports.some((f) => f.status === 'imported');
  const hotelsImported = tour.hotelImport != null;

  return (
    <article className="bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[4px] overflow-hidden shadow-[0_1px_0_rgba(21,19,15,0.04)]">
      <header className="px-8 pt-7 pb-5 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/60 relative">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="eyebrow">{tour.artistName} - {tour.name}</div>
            <h2 className="font-display text-[42px] leading-[0.95] font-bold text-[var(--color-ink)] mt-1.5">
              {fmtDate(day.date, 'EEEE, MMMM d')}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] font-semibold text-[var(--color-ink-2)]">
              <span>{day.city ?? '-'}{venue ? ` · ${venue.name}` : ''}</span>
              {venue && <MockTag source="venue" field="Venue name" />}
              {mode === 'personal' && (
                <span className="text-[var(--color-ink-4)] font-normal">· For: {effectiveUser.role}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="eyebrow">Day sheet</div>
            <div className="font-display text-[28px] leading-none font-bold tabular text-[var(--color-ink)]">
              {fmtDate(day.date, 'MM.dd')}
            </div>
            {mode === 'edit' && (
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                Edit view
              </div>
            )}
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
          {mode === 'edit' ? (
            <ScheduleEditor day={day} items={items} />
          ) : items.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)]">Nothing scheduled.</p>
          ) : (
            <ol className="divide-y divide-[var(--color-rule-soft)]">
              {items.map((it) => {
                const ruleKey = realRuleFor(it);
                return (
                  <li key={it.id} className="py-2.5 flex items-start gap-4">
                    <div className="font-mono tabular shrink-0 w-16 leading-snug">
                      <div className="text-[14px] font-semibold text-[var(--color-ink)]">{it.startTime}</div>
                      {it.endTime && (
                        <div className="text-[11px] text-[var(--color-ink-4)]">{it.endTime}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-px">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-[var(--color-ink)] inline-flex items-baseline gap-1">
                          {it.title}
                          {ruleKey && <SourceTag source={ruleKey} field={`${it.title} - rule source`} />}
                        </span>
                      </div>
                      {it.location && <div className="text-[12px] text-[var(--color-ink-3)] mt-0.5">{it.location}</div>}
                    </div>
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
            mockSource={flightsImported ? undefined : 'travel'}
            mockNote={flightsImported ? undefined : "Flight and bus segments are mock placeholders. Production data would come from travel-agent confirmations."}
            realSource={flightsImported ? 'flight_confirmation' : undefined}
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
            mockSource={hotelsImported ? undefined : 'hotel'}
            mockNote={hotelsImported ? undefined : "Hotel names, addresses, and check-in times are mock. The rider states rooming requirements, but the actual hotel comes from travel advance."}
            realSource={hotelsImported ? 'hotel_confirmation' : undefined}
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
                  <div key={m.id} className="flex items-start gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: g.color }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--color-ink)] truncate">{m.person.name}</div>
                      <div className="text-[11.5px] text-[var(--color-ink-3)] truncate">{m.role}</div>
                    </div>
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

const SCHEDULE_TYPE_OPTIONS: { value: string; label: string }[] = (
  [
    'load_in', 'soundcheck', 'doors', 'set', 'changeover', 'curfew', 'load_out',
    'bus_call', 'lobby_call', 'breakfast', 'lunch', 'dinner', 'press', 'meet_greet',
    'rehearsal', 'other',
  ] as ScheduleItemType[]
).map((t) => ({ value: t, label: scheduleItemLabel(t) }));

// Edit-mode schedule list. Field edits collect in local draft state and commit
// in one batch via the Save bar (one history record per changed item); add /
// delete mutate the tour immediately. Used by both the desktop and mobile
// sheets — only one is visible at a time.
function ScheduleEditor({ day, items }: { day: Day; items: ScheduleItem[] }) {
  const { user, updateScheduleItem, addScheduleItem, deleteScheduleItem, getScheduleItemHistory } = useApp();
  const [drafts, setDrafts] = useState<Record<string, ScheduleItemPatch>>({});
  useEffect(() => {
    setDrafts({});
  }, [day.id]);

  const setField = (id: string, field: keyof ScheduleItemPatch, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const val = (it: ScheduleItem, field: keyof ScheduleItemPatch): string => {
    const d = drafts[it.id];
    if (d && field in d) return String(d[field] ?? '');
    return String(it[field] ?? '');
  };

  // Only the fields that actually differ from the saved item.
  const patchFor = (it: ScheduleItem): ScheduleItemPatch => {
    const d = drafts[it.id];
    if (!d) return {};
    const patch: ScheduleItemPatch = {};
    (Object.keys(d) as (keyof ScheduleItemPatch)[]).forEach((field) => {
      if (field === 'endTime') {
        const cur = it.endTime ?? '';
        const nv = String(d.endTime ?? '').trim();
        if (nv !== cur) patch.endTime = nv === '' ? undefined : nv;
      } else if (field === 'type') {
        const nv = String(d.type ?? '');
        if (nv && nv !== it.type) patch.type = nv as ScheduleItemType;
      } else {
        const cur = String(it[field] ?? '');
        const nv = String(d[field] ?? '');
        const norm = field === 'startTime' ? nv.trim() : nv;
        if (norm !== cur) (patch as Record<string, string>)[field] = norm;
      }
    });
    return patch;
  };

  const rowInvalid = (it: ScheduleItem): boolean => {
    const start = val(it, 'startTime').trim();
    const end = val(it, 'endTime').trim();
    if (!isValidHHMM(start)) return true;
    if (end !== '' && !isValidHHMM(end)) return true;
    if (val(it, 'title').trim() === '') return true;
    return false;
  };

  const dirtyItems = items.filter((it) => Object.keys(patchFor(it)).length > 0);
  const dirtyCount = dirtyItems.length;
  const hasInvalid = dirtyItems.some(rowInvalid);

  const handleSave = () => {
    if (hasInvalid) return;
    for (const it of dirtyItems) {
      const patch = patchFor(it);
      if (Object.keys(patch).length > 0) updateScheduleItem(it.id, patch);
    }
    setDrafts({});
  };
  const handleDiscard = () => setDrafts({});
  const handleAdd = () => addScheduleItem(day.id, { title: 'New item', type: 'other', startTime: '12:00' });
  const handleDelete = (it: ScheduleItem) => {
    if (!window.confirm(`Delete "${it.title}"? This removes it from everyone's day sheet.`)) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[it.id];
      return next;
    });
    deleteScheduleItem(it.id);
  };

  return (
    <div>
      <p className="text-[11.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Editing as <span className="font-semibold text-[var(--color-ink)]">{user.name}</span>. Times and titles apply
        to every day sheet and calendar once you Save.
      </p>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)]">Nothing scheduled yet — add the first item below.</p>
      ) : (
        <ol className="divide-y divide-[var(--color-rule-soft)]">
          {items.map((it) => {
            const startBad = !isValidHHMM(val(it, 'startTime').trim());
            const endRaw = val(it, 'endTime').trim();
            const endBad = endRaw !== '' && !isValidHHMM(endRaw);
            return (
              <li key={it.id} className="py-2.5 flex items-start gap-3">
                <div className="w-[88px] shrink-0 space-y-1">
                  <EditableText
                    mono
                    value={val(it, 'startTime')}
                    placeholder="HH:MM"
                    disabled={false}
                    invalid={startBad}
                    onChange={(v) => setField(it.id, 'startTime', v)}
                  />
                  <EditableText
                    mono
                    value={val(it, 'endTime')}
                    placeholder="end —"
                    disabled={false}
                    invalid={endBad}
                    onChange={(v) => setField(it.id, 'endTime', v)}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <EditableText
                    value={val(it, 'title')}
                    placeholder="Title"
                    disabled={false}
                    className="text-[13.5px] font-semibold"
                    onChange={(v) => setField(it.id, 'title', v)}
                  />
                  <div className="flex gap-2">
                    <div className="w-[42%] min-w-0">
                      <EditableSelect
                        value={val(it, 'type')}
                        options={SCHEDULE_TYPE_OPTIONS}
                        disabled={false}
                        onChange={(v) => setField(it.id, 'type', v)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <EditableText
                        value={val(it, 'location')}
                        placeholder="Location"
                        disabled={false}
                        className="text-[12px] text-[var(--color-ink-3)]"
                        onChange={(v) => setField(it.id, 'location', v)}
                      />
                    </div>
                  </div>
                  <EditableText
                    value={val(it, 'notes')}
                    placeholder="Notes"
                    disabled={false}
                    className="text-[12px] text-[var(--color-ink-3)] italic"
                    onChange={(v) => setField(it.id, 'notes', v)}
                  />
                  {(it.sensitive || resolveVisibility(it.visibility, user) === 'blocked') && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {it.sensitive && (
                        <span className="inline-flex items-center">
                          <Chip tone="critical" size="sm">
                            <Icon.Lock size={9} /> Sensitive
                          </Chip>
                          <SensitiveExplain />
                        </span>
                      )}
                      {resolveVisibility(it.visibility, user) === 'blocked' && (
                        <Chip tone="off" size="sm">
                          Hidden for {user.name.split(' ')[0]}
                        </Chip>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(it)}
                  title={`Delete ${it.title}`}
                  className="shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-[3px] text-[var(--color-ink-4)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
                >
                  <Icon.X size={13} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 min-h-9 px-2 -mx-2 rounded-[3px] text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
        >
          <Icon.Plus size={12} /> Add item
        </button>
        {dirtyCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--color-warn)]">
              {hasInvalid ? 'Fix times / titles' : `${dirtyCount} unsaved`}
            </span>
            <Button size="sm" variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} disabled={hasInvalid}>
              Save changes
            </Button>
          </div>
        )}
      </div>

      <ScheduleEditHistory items={items} getScheduleItemHistory={getScheduleItemHistory} />
    </div>
  );
}

function ScheduleEditHistory({
  items,
  getScheduleItemHistory,
}: {
  items: ScheduleItem[];
  getScheduleItemHistory: (id: string) => ScheduleItemEditRecord[];
}) {
  const records = items
    .flatMap((it) => getScheduleItemHistory(it.id).map((r) => ({ r, title: it.title })))
    .sort((a, b) => b.r.resolvedAt.at.localeCompare(a.r.resolvedAt.at));
  if (records.length === 0) return null;
  return (
    <details className="mt-3 border-t border-[var(--color-rule-soft)] pt-3">
      <summary className="cursor-pointer text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
        {records.length} edit event{records.length === 1 ? '' : 's'} on this day
      </summary>
      <ol className="mt-2 divide-y divide-[var(--color-rule-soft)]">
        {records.map(({ r, title }, i) => (
          <li key={i} className="py-2 flex items-start gap-2.5">
            <Chip
              tone={r.status === 'deleted' ? 'critical' : r.status === 'created' ? 'success' : 'neutral'}
              size="sm"
            >
              {r.status === 'created' ? 'Added' : r.status === 'deleted' ? 'Deleted' : 'Edited'}
            </Chip>
            <div className="min-w-0">
              <div className="text-[12px] text-[var(--color-ink-2)]">
                {title} · {r.changes.length} change{r.changes.length === 1 ? '' : 's'} by{' '}
                <span className="font-semibold text-[var(--color-ink)]">{r.resolvedAt.by}</span>
              </div>
              <div className="font-mono text-[10.5px] tabular text-[var(--color-ink-4)]">
                {fmtDate(r.resolvedAt.at, 'MMM d, yyyy')} · {fmtDate(r.resolvedAt.at, 'h:mm a')}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function SheetSection({
  title,
  eyebrow,
  children,
  mockSource,
  mockNote,
  realSource,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  mockSource?: SourceKey;
  mockNote?: string;
  realSource?: RealSourceKey;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-[var(--color-rule-soft)]">
        <h3 className="font-display text-[18px] font-bold text-[var(--color-ink)] inline-flex items-baseline gap-1">
          {title}
          {realSource
            ? <SourceTag source={realSource} field={title} />
            : mockSource && <MockTag source={mockSource} field={title} note={mockNote} />}
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
