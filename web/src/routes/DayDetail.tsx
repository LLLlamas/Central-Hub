import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockTag } from '@/components/provenance/MockTag';
import { PersonName } from '@/components/provenance/PersonName';
import { SensitiveExplain } from '@/components/ExplainTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { LastUpdated } from '@/components/LastUpdated';
import { getMockVenue } from '@/data/mockVenues';
import {
  fmtFullDate,
  dayTypeLabel,
  travelModeLabel,
  travelModeIcon,
  initials,
} from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import type { TourPerson, Group } from '@/types';

type PersonPopoverTarget = {
  personId: string;
  rect: DOMRect;
};

export function DayDetail() {
  const { date } = useParams();
  const {
    tour,
    user,
    getDayLastUpdated,
    getDay,
    getScheduleItemsForDay,
    getTravelForDay,
    getHotelsForDay,
    getTasksForDay,
    getTourPersonById,
  } = useApp();
  const day = date ? getDay(date) : undefined;
  const [popover, setPopover] = useState<PersonPopoverTarget | null>(null);

  if (!day) {
    return (
      <div>
        <PageHeader title="Day not found" />
        <EmptyState
          title="That date isn't on this tour"
          hint="Pick a date from the calendar."
          action={
            <Link to="/calendar" className="text-[13px] underline">
              ← Back to calendar
            </Link>
          }
        />
      </div>
    );
  }

  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const dayIndex = tour.days.findIndex((d) => d.date === day.date);
  const prevDay = dayIndex > 0 ? tour.days[dayIndex - 1] : undefined;
  const nextDay = dayIndex < tour.days.length - 1 ? tour.days[dayIndex + 1] : undefined;
  const allItems = getScheduleItemsForDay(day.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const items = managerView ? allItems : allItems.filter((it) => resolveVisibility(it.visibility, user) !== 'blocked');
  const travel = getTravelForDay(day.id);
  const hotels = getHotelsForDay(day.id);
  const tasks = getTasksForDay(day.id);
  const venue = getMockVenue(day.venueId);

  return (
    <div>
      <PageHeader
        eyebrow={day.dayType.toUpperCase() + (day.city ? ` · ${day.city}` : '')}
        title={fmtFullDate(day.date)}
        description={day.notes}
        actions={
          <>
            <div className="inline-flex rounded-[3px] border border-[var(--color-rule)] overflow-hidden">
              {prevDay ? (
                <Link
                  to={`/calendar/${prevDay.date}`}
                  className="inline-flex items-center gap-1 h-9 px-2.5 text-[12px] font-semibold text-[var(--color-ink-2)] bg-[var(--color-card)] hover:bg-[var(--color-paper-2)] border-r border-[var(--color-rule)] transition-colors"
                >
                  <Icon.Chevron size={10} className="rotate-180" /> Yesterday
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 h-9 px-2.5 text-[12px] font-semibold text-[var(--color-ink-5)] bg-[var(--color-card)] border-r border-[var(--color-rule)] cursor-not-allowed select-none">
                  <Icon.Chevron size={10} className="rotate-180" /> Yesterday
                </span>
              )}
              <Link
                to="/calendar"
                className="inline-flex items-center h-9 px-3 text-[12px] font-semibold text-[var(--color-ink-2)] bg-[var(--color-card)] hover:bg-[var(--color-paper-2)] border-r border-[var(--color-rule)] transition-colors"
              >
                Calendar
              </Link>
              {nextDay ? (
                <Link
                  to={`/calendar/${nextDay.date}`}
                  className="inline-flex items-center gap-1 h-9 px-2.5 text-[12px] font-semibold text-[var(--color-ink-2)] bg-[var(--color-card)] hover:bg-[var(--color-paper-2)] transition-colors"
                >
                  Tomorrow <Icon.Chevron size={10} />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 h-9 px-2.5 text-[12px] font-semibold text-[var(--color-ink-5)] bg-[var(--color-card)] cursor-not-allowed select-none">
                  Tomorrow <Icon.Chevron size={10} />
                </span>
              )}
            </div>
            <Link
              to={`/daysheet/${day.date}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold rounded-[3px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
            >
              <Icon.Document size={14} /> Day sheet
            </Link>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={day.dayType}>{dayTypeLabel(day.dayType)}</Chip>
            <MockTag source="tour_route" field="DayType + city" />
            {day.weather && (
              <span className="inline-flex items-center gap-1">
                <Chip tone="neutral" variant="outline">
                  {day.weather.conditions} · {day.weather.low}°/{day.weather.high}°C
                </Chip>
                <MockTag source="day_weather" field="Weather forecast" />
              </span>
            )}
            {day.sunrise && day.sunset && (
              <Chip tone="neutral" variant="outline">
                ☀ {day.sunrise} – {day.sunset}
              </Chip>
            )}
            <LastUpdated stamp={getDayLastUpdated(day)} />
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-ink-4)] ml-auto">
              Viewing as {user.name}
            </span>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Schedule */}
        <SectionCard
          className="lg:col-span-2"
          title="Schedule"
          eyebrow={`${items.length} items today`}
          action={
            <div className="flex items-center gap-2">
              <MockTag source="schedule_item" field="Schedule items + times" />
              {managerView && (
                <Button size="sm" variant="outline" leading={<Icon.Plus size={12} />}>
                  Add item
                </Button>
              )}
            </div>
          }
        >
          {items.length === 0 ? (
            <EmptyState
              title="Nothing scheduled yet"
              hint="Pre-fill from a template like 'Arena Show Day' or add items one at a time."
            />
          ) : (
            <ol className="-mx-6 -my-2 divide-y divide-[var(--color-rule-soft)]">
              {items.map((it) => {
                const lvl = resolveVisibility(it.visibility, user);
                const visible = lvl !== 'blocked';
                return (
                  <li key={it.id} className={managerView && !visible ? 'opacity-40' : ''}>
                    <div className="px-6 py-3 flex items-start gap-4">
                      <div className="font-mono tabular text-[13px] font-semibold text-[var(--color-ink)] w-16 shrink-0 pt-0.5">
                        {it.startTime}
                        {it.endTime && (
                          <div className="text-[11px] font-normal text-[var(--color-ink-4)]">
                            – {it.endTime}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {it.sensitive && (
                            <span className="inline-flex items-center">
                              <Chip tone="critical" size="sm">
                                <Icon.Lock size={10} /> Sensitive
                              </Chip>
                              <SensitiveExplain />
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[13.5px] font-semibold text-[var(--color-ink)]">
                          {it.title}
                        </div>
                        {it.location && (
                          <div className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">
                            {it.location}
                          </div>
                        )}
                        {it.notes && (
                          <div className="mt-0.5 text-[12px] text-[var(--color-ink-3)] italic">
                            {it.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>

        {/* Side rail */}
        <div className="space-y-5">
          {/* Venue */}
          {venue && (
            <SectionCard
              title="Venue"
              eyebrow={venue.city}
              action={<MockTag source="venue" field="Venue details" />}
            >
              <div className="space-y-3 text-[12.5px]">
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">{venue.name}</div>
                  <div className="text-[var(--color-ink-2)] leading-snug mt-0.5">{venue.address}</div>
                  {venue.phone && (
                    <div className="font-mono tabular text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
                      <a href={`tel:${venue.phone.replace(/\s/g, '')}`} className="hover:underline">{venue.phone}</a>
                    </div>
                  )}
                  {venue.stageDoor && (
                    <div className="text-[11.5px] text-[var(--color-ink-3)] mt-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">Stage door</span>
                      {' '}{venue.stageDoor}
                    </div>
                  )}
                  {venue.capacity && (
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-[var(--color-ink-4)] mt-1">
                      Cap: {venue.capacity.toLocaleString()}
                    </div>
                  )}
                </div>
                {(venue.housePM || venue.promoterRep) && (
                  <div className="border-t border-[var(--color-rule-soft)] pt-3 space-y-2.5">
                    {venue.housePM && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">House PM</div>
                        <div className="font-semibold text-[var(--color-ink)]">{venue.housePM}</div>
                        {venue.housePMPhone && (
                          <a href={`tel:${venue.housePMPhone.replace(/\s/g, '')}`} className="font-mono text-[11px] tabular text-[var(--color-ink-3)] hover:underline">{venue.housePMPhone}</a>
                        )}
                      </div>
                    )}
                    {venue.promoterRep && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-4)]">{venue.promoter ?? 'Promoter'}</div>
                        <div className="font-semibold text-[var(--color-ink)]">{venue.promoterRep}</div>
                        {venue.promoterPhone && (
                          <a href={`tel:${venue.promoterPhone.replace(/\s/g, '')}`} className="font-mono text-[11px] tabular text-[var(--color-ink-3)] hover:underline">{venue.promoterPhone}</a>
                        )}
                        {venue.promoterEmail && managerView && (
                          <div className="font-mono text-[11px] tabular text-[var(--color-ink-3)] truncate">{venue.promoterEmail}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Travel */}
          <SectionCard
            title="Travel"
            eyebrow={`${travel.length} segment${travel.length === 1 ? '' : 's'}`}
            action={<MockTag source="travel" field="Travel segments" />}
          >
            {travel.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-3)]">No travel today.</p>
            ) : (
              <ul className="space-y-3 -my-1">
                {travel.map((t) => {
                  const lvl = resolveVisibility(t.visibility, user);
                  if (lvl === 'blocked') return null;
                  return (
                    <li key={t.id} className="border-l-2 pl-3 py-1" style={{ borderColor: 'var(--color-day-travel)' }}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[14px] text-[var(--color-day-travel)]">
                          {travelModeIcon(t.mode)}
                        </span>
                        <span className="text-[12.5px] font-semibold">
                          {travelModeLabel(t.mode)} · {t.carrier} {t.identifier}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[12px] tabular text-[var(--color-ink-2)]">
                        {t.from} {t.departTime} → {t.to} {t.arriveTime}
                      </div>
                      {t.recordLocator && (
                        <div className="font-mono text-[10.5px] tracking-[0.08em] uppercase text-[var(--color-ink-4)] mt-1">
                          PNR {t.recordLocator}
                        </div>
                      )}
                      <div className="text-[11.5px] text-[var(--color-ink-3)] mt-1">
                        {t.passengers.length} passenger{t.passengers.length === 1 ? '' : 's'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Hotel */}
          <SectionCard
            title="Hotel"
            eyebrow={`${hotels.length} block${hotels.length === 1 ? '' : 's'}`}
            action={<MockTag source="hotel" field="Hotel block" />}
          >
            {hotels.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-3)]">No hotel today.</p>
            ) : (
              <ul className="space-y-3">
                {hotels.map((h) => {
                  const lvl = resolveVisibility(h.visibility, user);
                  const blocked = lvl === 'blocked';
                  return (
                    <li key={h.id}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12.5px] font-semibold">{h.name}</span>
                        {h.sensitive && (
                          <span className="inline-flex items-center">
                            <Chip tone="critical" size="sm">
                              <Icon.Lock size={9} /> Sensitive
                            </Chip>
                            <SensitiveExplain />
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[var(--color-ink-3)]">
                        {blocked ? <em>Address hidden for your role</em> : h.address}
                      </div>
                      {!blocked && (
                        <div className="text-[11px] text-[var(--color-ink-4)] mt-0.5 tabular">
                          {h.occupants.length} occupant{h.occupants.length === 1 ? '' : 's'}
                          {h.checkIn && ` · check-in ${h.checkIn}`}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Tasks */}
          <SectionCard title="Tasks" eyebrow={`${tasks.length} for this day`} action={<MockTag source="task" field="Tasks" />}>
            {tasks.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-ink-3)]">No tasks tied to this day.</p>
            ) : (
              <ul className="space-y-2 -my-1">
                {tasks.map((t) => {
                  const owner = t.ownerTourPersonId ? getTourPersonById(t.ownerTourPersonId) : undefined;
                  return (
                    <li key={t.id} className="flex items-start gap-2">
                      <span
                        className="mt-1 inline-block w-2 h-2 rounded-full"
                        style={{
                          background:
                            t.status === 'done'
                              ? 'var(--color-day-promo)'
                              : t.status === 'doing'
                              ? 'var(--color-day-rehearsal)'
                              : 'var(--color-ink-5)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-[var(--color-ink)]">
                          {t.title}
                        </div>
                        {owner && (
                          <div className="text-[11px] text-[var(--color-ink-3)]">
                            Owner: <PersonName person={owner} /> · {owner.role}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* People scheduled on this day (groups summary) */}
      <SectionCard className="mt-5" title="Personnel on tour today" eyebrow="Roster">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tour.groups
            .filter((g) => tour.personnel.some((p) => p.groupId === g.id))
            .map((g) => {
              const members = tour.personnel.filter((p) => p.groupId === g.id);
              return (
                <div key={g.id} className="border border-[var(--color-rule-soft)] rounded-[3px] p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                    <span className="text-[12.5px] font-semibold">{g.name}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-[var(--color-ink-4)] tabular">
                      {members.length}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {members.slice(0, 5).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPopover(popover?.personId === m.id ? null : { personId: m.id, rect });
                        }}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9.5px] font-mono font-bold text-[var(--color-paper)] border border-[var(--color-rule)] cursor-pointer hover:opacity-80 transition-opacity ${m.isPlaceholder ? 'opacity-60' : ''}`}
                        style={{ background: g.color }}
                      >
                        {m.isPlaceholder ? '?' : initials(m.person.name)}
                      </button>
                    ))}
                    {members.length > 5 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9.5px] font-mono font-bold text-[var(--color-ink-3)] bg-[var(--color-paper-2)] border border-[var(--color-rule)]">
                        +{members.length - 5}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tour.groupTags
                      .filter((t) => t.groupId === g.id)
                      .map((t) => (
                        <span
                          key={t.id}
                          className="px-1.5 py-[1px] text-[10px] font-mono uppercase tracking-[0.06em] rounded-[2px]"
                          style={{ background: 'var(--color-paper-2)', color: 'var(--color-ink-3)' }}
                        >
                          {t.name}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
        </div>
      </SectionCard>

      {popover && (() => {
        const member = tour.personnel.find((p) => p.id === popover.personId);
        const group = member ? tour.groups.find((g) => g.id === member.groupId) : undefined;
        if (!member || !group) return null;
        return (
          <PersonPopover
            member={member}
            group={group}
            rect={popover.rect}
            onClose={() => setPopover(null)}
          />
        );
      })()}

      <DataSourcesPanel
        sourceKeys={['day', 'schedule_item', 'travel', 'hotel', 'task', 'visibility', 'venue']}
      />
    </div>
  );
}

function PersonPopover({
  member,
  group,
  rect,
  onClose,
}: {
  member: TourPerson;
  group: Group;
  rect: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const top = rect.bottom + window.scrollY + 6;
  const left = Math.min(rect.left + window.scrollX, window.innerWidth - 220);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'absolute', top, left, zIndex: 9999, width: 200 }}
      className="bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[4px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] p-3"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-mono font-bold text-[var(--color-paper)] shrink-0 ${member.isPlaceholder ? 'opacity-60' : ''}`}
          style={{ background: group.color }}
        >
          {member.isPlaceholder ? '?' : initials(member.person.name)}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--color-ink)] leading-snug truncate">
            {member.isPlaceholder ? <em className="not-italic text-[var(--color-ink-3)]">Name TBD</em> : member.person.name}
          </div>
          <div className="text-[11.5px] text-[var(--color-ink-3)] truncate">{member.role}</div>
          <div className="mt-0.5 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
            <span className="text-[10.5px] font-mono text-[var(--color-ink-4)]">{group.name}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
