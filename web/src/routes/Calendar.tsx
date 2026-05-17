import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { dayTypeLabel, fmtDate } from '@/lib/format';
import type { Day, DayType } from '@/types';
import { cn } from '@/lib/cn';
import { MOCK_TODAY } from '@/lib/today';
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays } from 'date-fns';

const ALL_TYPES: DayType[] = ['show', 'off', 'travel', 'rehearsal', 'promo', 'hold'];

export function CalendarPage() {
  const { tour, isDayLocked, lockedDays } = useApp();
  const [filter, setFilter] = useState<Set<DayType>>(new Set(ALL_TYPES));

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
        description="Tour days by date. Desktop keeps the month grid; phones use a scannable list."
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

      <div className="hidden md:flex card px-5 py-3.5 mb-7 flex-wrap items-center gap-x-5 gap-y-2">
        <div className="eyebrow mr-1">Legend</div>
        {ALL_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--color-day-${t})` }} />
            {dayTypeLabel(t)}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-2)] border-l border-[var(--color-rule-soft)] pl-5 ml-2">
          <Icon.Lock size={11} className="text-[var(--color-accent)]" />
          Locked / closed out
        </div>
        <span className="font-mono text-[11px] tabular text-[var(--color-ink-3)] ml-auto">
          {lockedDays.size} / {tour.days.length} locked
        </span>
      </div>

      <div className="md:hidden space-y-2">
        {tour.days
          .filter((d) => filter.has(d.dayType))
          .map((day) => (
            <DayListRow key={day.id} day={day} locked={isDayLocked(day.id)} isToday={day.date === MOCK_TODAY} />
          ))}
      </div>

      <div className="hidden md:block space-y-8">
        {months.map(([monthKey, monthDays]) => (
          <MonthGrid
            key={monthKey}
            monthKey={monthKey}
            monthDays={monthDays}
            allDays={dayByDate}
            filter={filter}
            isDayLocked={isDayLocked}
            today={MOCK_TODAY}
          />
        ))}
      </div>

      <DataSourcesPanel
        sourceKeys={['day', 'day_weather', 'venue', 'leg']}
        intro="The calendar is the spine. Days are auto-generated from the tour date range; the TM/PM sets the day type and confirms venue. All visible here is mocked."
      />
    </div>
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
              className="px-2 py-2 text-[10.5px] font-mono font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-4)] text-center"
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
    <div className="border border-[var(--color-rule-soft)] min-h-[88px] p-2 bg-[var(--color-paper)]/30 text-[var(--color-ink-5)]">
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
      <div className="border border-[var(--color-rule-soft)] min-h-[88px] p-2 bg-[var(--color-paper)]/40">
        <div className="text-[11px] font-mono tabular text-[var(--color-ink-4)]">{format(date, 'd')}</div>
        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-5)]">
          Not on tour
        </div>
      </div>
    );
  }

  return (
    <Link
      to={`/calendar/${iso}`}
      className={cn(
        'group block border border-[var(--color-rule-soft)] min-h-[88px] p-2 relative transition-all bg-[var(--color-card)] hover:bg-[var(--color-paper)]/40',
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
      <div className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.10em]" style={{ color: `var(--color-day-${day.dayType})` }}>
        {dayTypeLabel(day.dayType)}
      </div>
      {day.city && (
        <div className="mt-1 text-[12px] font-semibold leading-tight text-[var(--color-ink)] line-clamp-2">
          {day.city}
        </div>
      )}
      {isToday && (
        <div className="absolute bottom-2 right-2 font-mono text-[9px] uppercase tracking-[0.10em] text-[var(--color-accent)]">
          Today
        </div>
      )}
    </Link>
  );
}

function DayListRow({ day, locked, isToday }: { day: Day; locked: boolean; isToday: boolean }) {
  return (
    <Link
      to={`/calendar/${day.date}`}
      className={cn(
        'card min-h-[76px] px-4 py-3 flex items-center gap-3',
        isToday && 'border-[var(--color-accent)] bg-[var(--color-card)]',
      )}
    >
      <div className="w-12 shrink-0 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-4)]">
          {fmtDate(day.date, 'EEE')}
        </div>
        <div className="font-display text-[24px] font-bold leading-none tabular text-[var(--color-ink)]">
          {fmtDate(day.date, 'd')}
        </div>
      </div>
      <div className="w-1 self-stretch rounded-full" style={{ background: `var(--color-day-${day.dayType})` }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone={day.dayType} size="sm">{dayTypeLabel(day.dayType)}</Chip>
          {isToday && <Chip tone="critical" variant="outline" size="sm">Today</Chip>}
          {locked && (
            <Chip tone="critical" variant="outline" size="sm">
              <Icon.Lock size={9} /> Locked
            </Chip>
          )}
        </div>
        <div className="mt-1 text-[13px] font-semibold text-[var(--color-ink)] truncate">
          {day.city || dayTypeLabel(day.dayType)}
        </div>
      </div>
      <Icon.Chevron size={14} className="text-[var(--color-ink-4)]" />
    </Link>
  );
}
