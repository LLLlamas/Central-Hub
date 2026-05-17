import { useMemo, useState } from 'react';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { SensitiveExplain } from '@/components/ExplainTag';
import { VisibilityEditor } from '@/components/VisibilityEditor';
import { fmtDate, dayTypeLabel, scheduleItemLabel } from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import type { ScheduleItem, Visibility } from '@/types';
import { cn } from '@/lib/cn';

export function ScheduleAndVisibility() {
  const { tour, allUsers } = useApp();

  // pick first show day as default
  const firstShow = tour.scheduleItems[0];
  const [selectedId, setSelectedId] = useState<string | null>(firstShow?.id ?? null);
  const [editedVis, setEditedVis] = useState<Record<string, Visibility>>({});

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of tour.scheduleItems) {
      if (!map.has(it.dayId)) map.set(it.dayId, []);
      map.get(it.dayId)!.push(it);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [tour.scheduleItems]);

  const selected = tour.scheduleItems.find((i) => i.id === selectedId);
  const selectedVis = selected ? editedVis[selected.id] ?? selected.visibility : null;

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title={
          <>
            Schedule
          </>
        }
        description="Set call times and choose who sees, needs, or owns each item."
        actions={
          <Button variant="primary" leading={<Icon.Plus size={14} />}>
            New schedule item
          </Button>
        }
        meta={<MockBadge source="schedule_item" />}
      />

      <div className="grid lg:grid-cols-[280px_1fr_360px] gap-5">
        {/* Day picker — left */}
        <Card padded={false} className="overflow-hidden min-w-0">
          <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
            <div className="eyebrow">Days with schedule</div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {itemsByDay.size} of {tour.days.length} days
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-rule-soft)] max-h-[640px] overflow-y-auto">
            {Array.from(itemsByDay.entries()).map(([dayId, items]) => {
              const day = tour.days.find((d) => d.id === dayId)!;
              const hasSelected = items.some((i) => i.id === selectedId);
              return (
                <li key={dayId} className={hasSelected ? 'bg-[var(--color-paper)]/60' : ''}>
                  <div className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Chip tone={day.dayType} size="sm">
                        {dayTypeLabel(day.dayType)}
                      </Chip>
                      <div className="text-[12.5px] font-semibold">{fmtDate(day.date, 'EEE MMM d')}</div>
                    </div>
                    {day.city && (
                      <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">{day.city}</div>
                    )}
                  </div>
                  <ul className="border-t border-[var(--color-rule-soft)]/50">
                    {items.map((it) => {
                      const active = it.id === selectedId;
                      return (
                        <li key={it.id}>
                          <button
                            onClick={() => setSelectedId(it.id)}
                            className={cn(
                              'w-full text-left flex items-center gap-2 px-4 py-1.5 hover:bg-[var(--color-paper-2)]/60 transition-colors',
                              active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                            )}
                          >
                            <span
                              className={cn(
                                'font-mono text-[11px] tabular w-10',
                                active ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink-3)]',
                              )}
                            >
                              {it.startTime}
                            </span>
                            <span className="text-[12px] flex-1 min-w-0 truncate font-semibold">{it.title}</span>
                            {it.sensitive && <Icon.Lock size={10} className={active ? 'opacity-80' : 'text-[var(--color-accent)]'} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Center — item details + visibility editor */}
        <div className="space-y-5 min-w-0">
          {!selected ? (
            <EmptyState title="Select a schedule item" hint="Pick one from the left to inspect or edit." />
          ) : (
            <>
              <SectionCard
                title={selected.title}
                eyebrow={`${scheduleItemLabel(selected.type)} · ${selected.startTime}${selected.endTime ? `–${selected.endTime}` : ''}`}
                action={
                  <div className="flex items-center gap-1.5">
                    {selected.sensitive && (
                      <span className="inline-flex items-center">
                        <Chip tone="critical">
                          <Icon.Lock size={10} /> Sensitive
                        </Chip>
                        <SensitiveExplain />
                      </span>
                    )}
                    <Button size="sm" variant="outline" leading={<Icon.Settings size={12} />}>
                      Edit item
                    </Button>
                  </div>
                }
              >
                {selected.location && (
                  <div className="text-[13px] text-[var(--color-ink-2)] mb-2">
                    <span className="eyebrow mr-2">Location</span>
                    {selected.location}
                  </div>
                )}
                {selected.notes && (
                  <div className="text-[12.5px] text-[var(--color-ink-3)] italic mb-2">{selected.notes}</div>
                )}
                <div className="text-[11.5px] text-[var(--color-ink-4)] mt-2 font-mono tabular">
                  ID {selected.id}
                </div>
              </SectionCard>

              <SectionCard
                title="Visibility"
                eyebrow="Who can see it"
                action={<MockBadge source="visibility" />}
              >
                <p className="text-[12.5px] text-[var(--color-ink-3)] mb-4 leading-relaxed">
                  Visibility is per-item. Set a default and override for specific groups, tags, or persons. Most specific match wins. Owns implies Needs implies Sees.
                </p>
                <VisibilityEditor
                  value={selectedVis!}
                  groups={tour.groups}
                  tags={tour.groupTags}
                  persons={tour.personnel}
                  onChange={(v) =>
                    setEditedVis((prev) => ({ ...prev, [selected.id]: v }))
                  }
                />
              </SectionCard>
            </>
          )}
        </div>

        {/* Right — preview matrix */}
        <div className="space-y-5 min-w-0">
          <SectionCard title="Who sees this?" eyebrow="Live preview">
            {!selected || !selectedVis ? (
              <p className="text-[12px] text-[var(--color-ink-3)]">Select an item to preview.</p>
            ) : (
              <ul className="space-y-2 -my-1">
                {Object.values(allUsers).map((pseudo) => {
                  const lvl = resolveVisibility(selectedVis, pseudo);
                  return (
                    <li key={pseudo.tourPersonId} className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] text-[var(--color-ink)] min-w-0 truncate">
                        {pseudo.name}
                        <span className="text-[var(--color-ink-4)]"> · {pseudo.role}</span>
                      </span>
                      <LevelPill level={lvl} />
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <Card>
            <div className="eyebrow mb-2">Levels</div>
            <ul className="space-y-2 text-[12px]">
              <LegendRow label="Owns" desc="View and edit." color="var(--color-vis-owns)" />
              <LegendRow label="Needs" desc="Must see — affects their day." color="var(--color-vis-needs)" />
              <LegendRow label="Sees" desc="Can view if they look." color="var(--color-vis-sees)" />
              <LegendRow label="Blocked" desc="Hidden — not on their day sheet." color="var(--color-vis-blocked)" />
            </ul>
          </Card>
        </div>
      </div>

      <DataSourcesPanel
        sourceKeys={['schedule_item', 'visibility', 'group', 'group_tag']}
      />
    </div>
  );
}

function LevelPill({ level }: { level: 'blocked' | 'sees' | 'needs' | 'owns' }) {
  const tone =
    level === 'owns' ? 'critical' : level === 'needs' ? 'rehearsal' : level === 'sees' ? 'travel' : 'off';
  const label =
    level === 'owns' ? 'Owns' : level === 'needs' ? 'Needs' : level === 'sees' ? 'Sees' : 'Hidden';
  return (
    <Chip tone={tone as any} variant="soft" size="sm">
      {label}
    </Chip>
  );
}

function LegendRow({ label, desc, color }: { label: string; desc: string; color: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div>
        <span className="font-semibold text-[var(--color-ink)]">{label}</span>
        <span className="text-[var(--color-ink-3)]"> — {desc}</span>
      </div>
    </li>
  );
}
