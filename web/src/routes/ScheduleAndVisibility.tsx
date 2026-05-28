import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/state/AppState';
import type { PendingVisibilityEdit, VisibilityEditRecord } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { SensitiveExplain } from '@/components/ExplainTag';
import { LastUpdated } from '@/components/LastUpdated';
import { VisibilityEditor } from '@/components/VisibilityEditor';
import { TypeDefaultsEditor } from '@/components/TypeDefaultsEditor';
import { fmtDate, dayTypeLabel, scheduleItemLabel } from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import type { ScheduleItem, Visibility, VisibilityLevel } from '@/types';
import { cn } from '@/lib/cn';

export function ScheduleAndVisibility() {
  const {
    tour,
    user,
    allUsers,
    getVisibilityEdit,
    updateVisibilityEdit,
    saveVisibilityForType,
    getPendingVisibilityEdit,
    proposeVisibilityEdit,
    approvePendingVisibilityEdit,
    rejectPendingVisibilityEdit,
    getVisibilityHistory,
  } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';

  // pick first show day as default
  const firstShow = tour.scheduleItems[0];
  const [selectedId, setSelectedId] = useState<string | null>(firstShow?.id ?? null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

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
  const pendingVis = selected ? getPendingVisibilityEdit(selected.id) : undefined;
  const committedVis = selected
    ? pendingVis?.patch ?? getVisibilityEdit(selected.id) ?? selected.visibility
    : null;

  // Draft state — edits collect locally until the user clicks Save. Reset
  // whenever the selected item changes so jumping between items doesn't
  // carry stale drafts. `displayVis` is what the editor renders.
  const [draftVis, setDraftVis] = useState<Visibility | null>(null);
  useEffect(() => {
    setDraftVis(null);
  }, [selectedId]);
  const displayVis = draftVis ?? committedVis;
  const isDirty =
    draftVis !== null && committedVis !== null && JSON.stringify(draftVis) !== JSON.stringify(committedVis);

  // Manager Save cascades to every schedule item of the same type — "schedule
  // grouping": one save configures all `lobby_call` / `lunch` / etc. items at
  // once. Non-managers still propose per-item via the pending workflow.
  const handleSaveVis = () => {
    if (!selected || !draftVis || !committedVis) return;
    if (managerView) saveVisibilityForType(selected.type, draftVis);
    else proposeVisibilityEdit(selected.id, draftVis, committedVis);
    setDraftVis(null);
  };
  const handleDiscardVis = () => setDraftVis(null);

  // Cascade count — how many items the Save will affect. Used to label the
  // Save button so the manager knows the scope of the action.
  const cascadeCount = selected
    ? tour.scheduleItems.filter((i) => i.type === selected.type).length
    : 0;

  if (!managerView) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center max-w-sm">
          <div className="text-[15px] font-semibold text-[var(--color-ink)] mb-1">Access restricted</div>
          <p className="text-[13px] text-[var(--color-ink-3)]">Schedule permissions are managed by the Tour Manager and Production Manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Daily ops"
        title="Schedule Permissions"
        description="Set call times and control who sees or owns each item."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leading={<Icon.Sparkle size={12} />}
              onClick={() => setDefaultsOpen(true)}
            >
              Defaults by type
            </Button>
            <Button variant="primary" leading={<Icon.Plus size={14} />}>
              New schedule item
            </Button>
          </div>
        }
        meta={<MockBadge source="schedule_item" />}
      />
      <TypeDefaultsEditor open={defaultsOpen} onClose={() => setDefaultsOpen(false)} />

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
                      // "Sibling" = same type as the selected item, but not
                      // the selected one. These get a soft tint so the user
                      // can see exactly which other items Save will affect.
                      const isSibling = !active && selected && it.type === selected.type;
                      return (
                        <li key={it.id}>
                          <button
                            onClick={() => setSelectedId(it.id)}
                            className={cn(
                              'w-full text-left flex items-center gap-2 px-4 py-1.5 transition-colors',
                              active
                                ? 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]'
                                : isSibling
                                ? 'bg-[var(--color-paper-2)]/70 hover:bg-[var(--color-paper-2)]'
                                : 'hover:bg-[var(--color-paper-2)]/60',
                            )}
                            title={isSibling ? `Same type as the selected item — Save will apply to this too.` : undefined}
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
                            {isSibling && (
                              <span
                                className="w-1 h-1 rounded-full bg-[var(--color-ink-3)] shrink-0"
                                aria-hidden
                              />
                            )}
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
                  selected.sensitive ? (
                    <span className="inline-flex items-center">
                      <Chip tone="critical">
                        <Icon.Lock size={10} /> Sensitive
                      </Chip>
                      <SensitiveExplain />
                    </span>
                  ) : undefined
                }
              >
                {selected.location && (
                  <div className="text-[13px] text-[var(--color-ink-2)]">
                    <span className="eyebrow mr-2">Location</span>
                    {selected.location}
                  </div>
                )}
                {selected.notes && (
                  <div className="text-[12.5px] text-[var(--color-ink-3)] italic mt-2">{selected.notes}</div>
                )}
              </SectionCard>

              <SectionCard
                title="Visibility"
                eyebrow="Who can see it"
                action={
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--color-warn)]">
                        Unsaved
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDiscardVis}
                      disabled={!isDirty}
                    >
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleSaveVis}
                      disabled={!isDirty}
                      title={
                        managerView
                          ? `Save and apply to all ${cascadeCount} ${scheduleItemLabel(selected.type).toLowerCase()}${cascadeCount === 1 ? '' : 's'}`
                          : undefined
                      }
                    >
                      {managerView
                        ? cascadeCount > 1
                          ? `Save (× ${cascadeCount})`
                          : 'Save'
                        : 'Propose changes'}
                    </Button>
                    <MockBadge source="visibility" />
                  </div>
                }
              >
                <p className="text-[12.5px] text-[var(--color-ink-3)] mb-4 leading-relaxed">
                  Visibility is grouped by item type. Edit one {scheduleItemLabel(selected.type).toLowerCase()}
                  {' '}and Save — the same permissions apply to{' '}
                  <strong>all {cascadeCount} {scheduleItemLabel(selected.type).toLowerCase()}{cascadeCount === 1 ? '' : 's'}</strong>
                  {' '}across the tour, plus any future ones of this type.
                </p>
                {pendingVis && (
                  <PendingVisibilityBanner
                    pending={pendingVis}
                    managerView={managerView}
                    onApprove={() => approvePendingVisibilityEdit(selected.id)}
                    onReject={() => rejectPendingVisibilityEdit(selected.id)}
                  />
                )}
                <VisibilityEditor
                  value={displayVis!}
                  groups={tour.groups}
                  tags={tour.groupTags}
                  persons={tour.personnel}
                  onChange={setDraftVis}
                />
                {getVisibilityHistory(selected.id).length > 0 && (
                  <VisibilityHistory records={getVisibilityHistory(selected.id)} />
                )}
              </SectionCard>
            </>
          )}
        </div>

        {/* Right — preview matrix */}
        <div className="space-y-5 min-w-0">
          <SectionCard title="Who sees this?" eyebrow="Live preview">
            {!selected || !displayVis ? (
              <p className="text-[12px] text-[var(--color-ink-3)]">Select an item to preview.</p>
            ) : (
              <ul className="space-y-2 -my-1">
                {Object.values(allUsers).map((pseudo) => {
                  const lvl = resolveVisibility(displayVis, pseudo);
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
              <LegendRow label="Owns" desc="Can view and edit." color="var(--color-vis-owns)" />
              <LegendRow label="Sees" desc="Can view — it's on their day sheet." color="var(--color-vis-sees)" />
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

function LevelPill({ level }: { level: VisibilityLevel }) {
  const tone = level === 'owns' ? 'critical' : level === 'sees' ? 'travel' : 'off';
  const label = level === 'owns' ? 'Owns' : level === 'sees' ? 'Sees' : 'Hidden';
  return (
    <Chip tone={tone as any} variant="soft" size="sm">
      {label}
    </Chip>
  );
}

function PendingVisibilityBanner({
  pending,
  managerView,
  onApprove,
  onReject,
}: {
  pending: PendingVisibilityEdit;
  managerView: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-[3px] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/6 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Icon.Alert size={12} className="text-[var(--color-accent)] shrink-0" />
        <LastUpdated label="Proposed" stamp={pending.proposedAt} />
      </div>
      {managerView ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
          <Button size="sm" variant="primary" leading={<Icon.Check size={12} />} onClick={onApprove}>
            Approve change
          </Button>
        </div>
      ) : (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
          Awaiting approval
        </span>
      )}
    </div>
  );
}

function VisibilityHistory({ records }: { records: VisibilityEditRecord[] }) {
  return (
    <details className="mt-4 border-t border-[var(--color-rule-soft)] pt-3">
      <summary className="cursor-pointer text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
        {records.length} edit event{records.length === 1 ? '' : 's'}
      </summary>
      <ol className="mt-2 divide-y divide-[var(--color-rule-soft)]">
        {[...records].reverse().map((r, i) => (
          <li key={i} className="py-2 flex items-start gap-2.5">
            <Chip
              tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'critical' : 'neutral'}
              size="sm"
            >
              {r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Direct'}
            </Chip>
            <div className="min-w-0">
              <div className="text-[12px] text-[var(--color-ink-2)]">
                {r.changes.length} field change{r.changes.length === 1 ? '' : 's'} by{' '}
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
