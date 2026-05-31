import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { dayTypeLabel } from '@/lib/format';
import type { Day, DayType } from '@/types';
import { cn } from '@/lib/cn';
import { getTodayIso } from '@/lib/today';
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays } from 'date-fns';

const ALL_TYPES: DayType[] = ['show', 'off', 'travel', 'rehearsal', 'promo', 'hold'];

type CalView = 'list' | 'grid';

export function CalendarPage() {
  const { tour, isDayLocked, lockedDays } = useApp();
  const [filter, setFilter] = useState<Set<DayType>>(new Set(ALL_TYPES));
  const [view, setView] = useState<CalView>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 'grid' : 'list',
  );

  const months = useMemo(() => {
    const map = new Map<string, Day[]>();
    for (const d of tour.days) {
      const key = format(parseISO(d.date), 'yyyy-MM');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort();
  }, [tour.days]);

  const dayByDate = useMemo(() => Object.fromEntries(tour.days.map((d) => [d.date, d])), [tour.days]);

  function toggleFilter(t: DayType) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Tour days by date — switch between a scannable list and the month grid."
        actions={<ViewToggle view={view} setView={setView} />}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] mr-1">
              Filter
            </span>
            {ALL_TYPES.map((t) => {
              const active = filter.has(t);
              const count = tour.days.filter((d) => d.dayType === t).length;
              return (
                <button
                  key={t}
                  onClick={() => toggleFilter(t)}
                  className={cn(
                    'min-h-8 inline-flex items-center gap-1.5 px-2 rounded-[3px] text-[11px] font-mono font-semibold uppercase tracking-[0.08em] border transition-colors',
                    active
                      ? 'border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)]'
                      : 'border-transparent text-[var(--color-ink-4)]',
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--color-day-${t})` }} />
                  {dayTypeLabel(t)} <span className="text-[var(--color-ink-4)] tabular">{count}</span>
                </button>
              );
            })}
            <MockBadge source="day" className="ml-2 hidden sm:inline-flex" />
          </div>
        }
      />

      {view === 'grid' && (
        <div className="card px-5 py-3.5 mb-7 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="eyebrow mr-1">Legend</div>
          {ALL_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--color-day-${t})` }} />
              {dayTypeLabel(t)}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)] sm:border-l border-[var(--color-rule-soft)] sm:pl-5">
            <Icon.Lock size={11} className="text-[var(--color-accent)]" />
            Locked / closed out
          </div>
          <span className="font-mono text-[11px] tabular text-[var(--color-ink-3)] ml-auto">
            {lockedDays.size} / {tour.days.length} locked
          </span>
        </div>
      )}

      {view === 'list' ? (
        <div className="space-y-7">
          {months.map(([monthKey, monthDays]) => {
            const visible = monthDays.filter((d) => filter.has(d.dayType));
            if (visible.length === 0) return null;
            return (
              <section key={monthKey}>
                <h2 className="font-display text-[20px] font-bold text-[var(--color-ink)] mb-3">
                  {format(parseISO(monthKey + '-01'), 'MMMM yyyy')}
                </h2>
                <div className="space-y-2">
                  {visible.map((day) => (
                    <DayListRow
                      key={day.id}
                      day={day}
                      locked={isDayLocked(day.id)}
                      isToday={day.date === getTodayIso()}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {months.map(([monthKey, monthDays]) => (
            <MonthGrid
              key={monthKey}
              monthKey={monthKey}
              monthDays={monthDays}
              allDays={dayByDate}
              filter={filter}
              isDayLocked={isDayLocked}
              today={getTodayIso()}
            />
          ))}
        </div>
      )}

      <DataSourcesPanel
        sourceKeys={['day', 'day_weather', 'venue', 'leg']}
        intro="The calendar is the spine. Days are auto-generated from the tour date range; the TM/PM sets the day type and confirms venue. All visible here is mocked."
      />
    </div>
  );
}

function ViewToggle({ view, setView }: { view: CalView; setView: (v: CalView) => void }) {
  return (
    <div className="inline-flex rounded-[4px] border border-[var(--color-rule)] overflow-hidden bg-[var(--color-card)]">
      {(['list', 'grid'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          className={cn(
            'px-3.5 min-h-11 md:min-h-8 text-[11px] font-mono font-semibold uppercase tracking-[0.10em] transition-colors',
            view === v
              ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
              : 'text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)]',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function DayListRow({ day, locked, isToday }: { day: Day; locked: boolean; isToday: boolean }) {
  const d = parseISO(day.date);
  return (
    <Link
      to={`/calendar/${day.date}`}
      className={cn(
        'card flex items-center gap-3 px-4 py-3 min-h-[76px]',
        isToday && 'border-[var(--color-accent)]',
      )}
    >
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: `var(--color-day-${day.dayType})` }}
      />
      <div className="flex-1 min-w-0">
        <div className="eyebrow">{format(d, 'EEEE')}</div>
        <div className="text-[15px] font-semibold text-[var(--color-ink)] leading-tight">
          {format(d, 'MMMM d, yyyy')}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone={day.dayType} size="sm">{dayTypeLabel(day.dayType)}</Chip>
          {isToday && <Chip tone="critical" variant="outline" size="sm">Today</Chip>}
          {locked && (
            <Chip tone="critical" variant="outline" size="sm">
              <Icon.Lock size={9} /> Locked
            </Chip>
          )}
          {day.city && (
            <span className="text-[12.5px] text-[var(--color-ink-3)] truncate">{day.city}</span>
          )}
        </div>
      </div>
      <Icon.Chevron size={14} className="text-[var(--color-ink-4)] shrink-0" />
    </Link>
  );
}

function MonthGrid({
  monthKey,
  monthDays,
  allDays,
  filter,
  isDayLocked,
  today,
}: {
  monthKey: string;
  monthDays: Day[];
  allDays: Record<string, Day>;
  filter: Set<DayType>;
  isDayLocked: (id: string) => boolean;
  today: string;
}) {
  const monthDate = parseISO(monthKey + '-01');
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const dim = eachDayOfInterval({ start, end });
  const startWeekday = getDay(start);
  const pad: Date[] = [];
  for (let i = 0; i < startWeekday; i++) pad.push(addDays(start, -startWeekday + i));

  const shows = monthDays.filter((d) => d.dayType === 'show');

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="eyebrow">{format(monthDate, 'yyyy')}</div>
          <h2 className="font-display text-[28px] leading-none font-bold">
            {format(monthDate, 'MMMM')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="show" variant="outline">{shows.length} shows</Chip>
          <Chip tone="neutral" variant="outline">{monthDays.length} days</Chip>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--color-rule-soft)]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="px-1 sm:px-2 py-2 text-[10.5px] font-mono font-semibold uppercase tracking-[0.10em] sm:tracking-[0.14em] text-[var(--color-ink-4)] text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 -m-px">
          {pad.map((d, i) => (
            <CellEmpty key={`p${i}`} date={d} />
          ))}
          {dim.map((date) => {
            const iso = format(date, 'yyyy-MM-dd');
            const day = allDays[iso];
            return (
              <DayCell
                key={iso}
                date={date}
                day={day}
                dimmed={!day || !filter.has(day.dayType)}
                locked={day ? isDayLocked(day.id) : false}
                isToday={iso === today}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CellEmpty({ date }: { date: Date }) {
  return (
    <div className="border border-[var(--color-rule-soft)] min-h-[56px] sm:min-h-[88px] p-1.5 sm:p-2 bg-[var(--color-paper)]/30 text-[var(--color-ink-5)]">
      <div className="text-[11px] font-mono tabular">{format(date, 'd')}</div>
    </div>
  );
}

function DayCell({
  date,
  day,
  dimmed,
  locked,
  isToday,
}: {
  date: Date;
  day?: Day;
  dimmed: boolean;
  locked: boolean;
  isToday: boolean;
}) {
  const iso = format(date, 'yyyy-MM-dd');
  if (!day) {
    return (
      <div className="border border-[var(--color-rule-soft)] min-h-[56px] sm:min-h-[88px] p-1.5 sm:p-2 bg-[var(--color-paper)]/40">
        <div className="text-[11px] font-mono tabular text-[var(--color-ink-4)]">{format(date, 'd')}</div>
        <div className="mt-1 hidden sm:block text-[10px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-5)]">
          Not on tour
        </div>
      </div>
    );
  }

  return (
    <Link
      to={`/calendar/${iso}`}
      className={cn(
        'group block border border-[var(--color-rule-soft)] min-h-[56px] sm:min-h-[88px] p-1.5 sm:p-2 relative transition-all bg-[var(--color-card)] hover:bg-[var(--color-paper)]/40',
        dimmed && 'opacity-30',
        locked && 'bg-[var(--color-paper)]/55',
        isToday && 'ring-2 ring-[var(--color-accent)]/40 ring-inset',
      )}
      style={{ borderLeftWidth: '3px', borderLeftColor: `var(--color-day-${day.dayType})` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono font-semibold tabular text-[var(--color-ink-2)]">
          {format(date, 'd')}
        </span>
        <span className="inline-flex items-center gap-1">
          {locked && <Icon.Lock size={10} className="text-[var(--color-accent)]" aria-label="Locked / closed out" />}
          <span className="w-2 h-2 rounded-full" style={{ background: `var(--color-day-${day.dayType})` }} aria-label={dayTypeLabel(day.dayType)} />
        </span>
      </div>
      <div className="hidden sm:block text-[10.5px] font-mono font-semibold uppercase tracking-[0.10em]" style={{ color: `var(--color-day-${day.dayType})` }}>
        {dayTypeLabel(day.dayType)}
      </div>
      {day.city && (
        <div className="mt-1 hidden sm:block text-[12px] font-semibold leading-tight text-[var(--color-ink)] line-clamp-2">
          {day.city}
        </div>
      )}
      {isToday && (
        <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 font-mono text-[9px] uppercase tracking-[0.10em] text-[var(--color-accent)]">
          Today
        </div>
      )}
    </Link>
  );
}
