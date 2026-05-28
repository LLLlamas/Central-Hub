import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import type { PendingVisibilityEdit, VisibilityEditRecord } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { SensitiveExplain } from '@/components/ExplainTag';
import { LastUpdated } from '@/components/LastUpdated';
import { VisibilityEditor } from '@/components/VisibilityEditor';
import { TypeDefaultsEditor } from '@/components/TypeDefaultsEditor';
import { fmtDate, dayTypeLabel, scheduleItemLabel } from '@/lib/format';
import { resolveVisibility } from '@/lib/visibility';
import { isValidHHMM } from '@/lib/time';
import type { Day, ScheduleItem, ScheduleItemType, Visibility, VisibilityLevel } from '@/types';
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
    addScheduleItem,
    deleteScheduleItem,
  } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';

  // pick first show day as default
  const firstShow = tour.scheduleItems[0];
  const [selectedId, setSelectedId] = useState<string | null>(firstShow?.id ?? null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const handleDeleteSelected = (item: ScheduleItem) => {
    if (!window.confirm(`Delete "${item.title}"? This removes it from everyone's day sheet and calendar.`)) return;
    // Reselect a neighbor so the editor doesn't drop to the empty state.
    const idx = tour.scheduleItems.findIndex((i) => i.id === item.id);
    const neighbor = tour.scheduleItems[idx + 1] ?? tour.scheduleItems[idx - 1];
    deleteScheduleItem(item.id);
    setSelectedId(neighbor?.id ?? null);
  };

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
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setNewItemOpen(true)}>
              New schedule item
            </Button>
          </div>
        }
        meta={<MockBadge source="schedule_item" />}
      />
      <TypeDefaultsEditor open={defaultsOpen} onClose={() => setDefaultsOpen(false)} />
      <NewScheduleItemModal
        open={newItemOpen}
        onClose={() => setNewItemOpen(false)}
        days={tour.days}
        defaultDayId={selected?.dayId ?? tour.days[0]?.id}
        onCreate={(dayId, init) => {
          const id = addScheduleItem(dayId, init);
          setSelectedId(id);
          setNewItemOpen(false);
        }}
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
                      // "Edited" = a saved visibility override exists. The
                      // whole row gets a soft green tint so the manager can
                      // see at a glance which types they've configured.
                      const edited = !!getVisibilityEdit(it.id);
                      // "Sibling" = same type as the selected item, but not
                      // the selected one. These get a tan tint so the user
                      // can see exactly which other items Save will affect.
                      const isSibling = !active && selected && it.type === selected.type;
                      const tipParts: string[] = [];
                      if (edited) tipParts.push('Visibility has been configured for this item.');
                      if (isSibling) tipParts.push('Same type as the selected item — Save will apply to this too.');
                      return (
                        <li key={it.id}>
                          <button
                            onClick={() => setSelectedId(it.id)}
                            className={cn(
                              'w-full text-left flex items-center gap-2 px-4 py-1.5 transition-colors',
                              active
                                ? edited
                                  ? 'text-[var(--color-paper)]'
                                  : 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]'
                                : edited
                                ? 'bg-[#5a8a55]/15 hover:bg-[#5a8a55]/25'
                                : isSibling
                                ? 'bg-[var(--color-paper-2)]/70 hover:bg-[var(--color-paper-2)]'
                                : 'hover:bg-[var(--color-paper-2)]/60',
                            )}
                            style={active && edited ? { background: '#2d4a2a' } : undefined}
                            title={tipParts.join(' ') || undefined}
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
                            {!edited && isSibling && (
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
              {(() => {
                const selectedDay = tour.days.find((d) => d.id === selected.dayId);
                const dayLabel = selectedDay ? fmtDate(selectedDay.date, 'EEE MMM d') : null;
                const eyebrow = [
                  scheduleItemLabel(selected.type),
                  `${selected.startTime}${selected.endTime ? `–${selected.endTime}` : ''}`,
                  dayLabel,
                ]
                  .filter(Boolean)
                  .join(' · ');
                const dayHref = selectedDay ? `/daysheet/${selectedDay.date}` : null;
                const cardInner = (
                  <div className="flex items-start justify-between gap-3 flex-wrap px-6 py-5">
                    <div className="min-w-0">
                      <div className="eyebrow mb-1">{eyebrow}</div>
                      <h3 className="font-display text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
                        {selected.title}
                      </h3>
                      {selected.location && (
                        <div className="text-[13px] text-[var(--color-ink-2)] mt-2">
                          <span className="eyebrow mr-2">Location</span>
                          {selected.location}
                        </div>
                      )}
                      {selected.notes && (
                        <div className="text-[12.5px] text-[var(--color-ink-3)] italic mt-2">
                          {selected.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {selected.sensitive && (
                        <span className="inline-flex items-center">
                          <Chip tone="critical">
                            <Icon.Lock size={10} /> Sensitive
                          </Chip>
                          <SensitiveExplain />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteSelected(selected);
                        }}
                        title="Delete this schedule item"
                        className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
                      >
                        <Icon.X size={12} /> Delete
                      </button>
                      {dayHref && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                          Day sheet
                          <Icon.Chevron size={11} />
                        </span>
                      )}
                    </div>
                  </div>
                );
                return dayHref ? (
                  <Link
                    to={dayHref}
                    title={`Open day sheet for ${dayLabel}`}
                    className="block bg-[var(--color-card)] rounded-[4px] border border-[var(--color-rule)] hover:border-[var(--color-ink)] hover:shadow-[0_2px_8px_rgba(21,19,15,0.06)] transition-all"
                  >
                    {cardInner}
                  </Link>
                ) : (
                  <Card padded={false}>{cardInner}</Card>
                );
              })()}

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

          <PermissionsStatus
            scheduleItems={tour.scheduleItems}
            getVisibilityEdit={getVisibilityEdit}
            onJumpTo={setSelectedId}
          />

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

const SCHEDULE_TYPES: ScheduleItemType[] = [
  'load_in', 'soundcheck', 'doors', 'set', 'changeover', 'curfew', 'load_out',
  'bus_call', 'lobby_call', 'breakfast', 'lunch', 'dinner', 'press', 'meet_greet',
  'rehearsal', 'other',
];

const FORM_INPUT =
  'w-full h-9 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)]';

// Create a schedule item from scratch — pick a day + type + time + title, then
// the new item lands in the tour (and the list) ready for visibility config.
function NewScheduleItemModal({
  open,
  onClose,
  days,
  defaultDayId,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  days: Day[];
  defaultDayId?: string;
  onCreate: (dayId: string, init: { type: ScheduleItemType; startTime: string; title: string }) => void;
}) {
  const [dayId, setDayId] = useState(defaultDayId ?? '');
  const [type, setType] = useState<ScheduleItemType>('other');
  const [startTime, setStartTime] = useState('12:00');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    setDayId(defaultDayId ?? days[0]?.id ?? '');
    setType('other');
    setStartTime('12:00');
    setTitle('');
  }, [open, defaultDayId, days]);

  const validTime = isValidHHMM(startTime.trim());
  const canCreate = !!dayId && validTime;

  return (
    <Modal open={open} onClose={onClose} eyebrow="Schedule" title="New schedule item" size="sm">
      <div className="space-y-4">
        <FormField label="Day">
          <select value={dayId} onChange={(e) => setDayId(e.target.value)} className={FORM_INPUT}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {fmtDate(d.date, 'EEE MMM d')}
                {d.city ? ` · ${d.city}` : ''}
              </option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ScheduleItemType)}
              className={FORM_INPUT}
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {scheduleItemLabel(t)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Start time">
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="HH:MM"
              className={cn(FORM_INPUT, 'font-mono', !validTime && 'border-[var(--color-accent)]')}
            />
          </FormField>
        </div>
        <FormField label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={scheduleItemLabel(type)}
            className={FORM_INPUT}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canCreate}
            onClick={() =>
              onCreate(dayId, { type, startTime: startTime.trim(), title: title.trim() || scheduleItemLabel(type) })
            }
          >
            Create item
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1">{label}</span>
      {children}
    </label>
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

// Tracks which schedule-item TYPES still need permissions configured. Because
// Save cascades by type, the unit of "configured" is the type — once any
// item of a type has a saved visibility edit, every item of that type is
// covered. Clicking a remaining type jumps the editor to its first item.
function PermissionsStatus({
  scheduleItems,
  getVisibilityEdit,
  onJumpTo,
}: {
  scheduleItems: ScheduleItem[];
  getVisibilityEdit: (itemId: string) => Visibility | undefined;
  onJumpTo: (itemId: string) => void;
}) {
  // Group items by type, mark each type as configured if any of its items
  // has a saved visibility edit.
  const byType = new Map<string, { configured: boolean; items: ScheduleItem[] }>();
  for (const it of scheduleItems) {
    const slot = byType.get(it.type) ?? { configured: false, items: [] };
    slot.items.push(it);
    if (getVisibilityEdit(it.id)) slot.configured = true;
    byType.set(it.type, slot);
  }
  const totalTypes = byType.size;
  const configuredTypes = Array.from(byType.values()).filter((s) => s.configured).length;
  const remaining = Array.from(byType.entries())
    .filter(([, s]) => !s.configured)
    .map(([type, s]) => ({ type, items: s.items }));
  const allDone = totalTypes > 0 && remaining.length === 0;

  if (totalTypes === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow">Permissions status</div>
        <span
          className={cn(
            'text-[11px] font-mono font-semibold tabular',
            allDone ? 'text-[#5a8a55]' : 'text-[var(--color-ink-3)]',
          )}
        >
          {configuredTypes} / {totalTypes}
        </span>
      </div>
      {allDone ? (
        <p className="text-[12px] text-[var(--color-ink-2)] leading-relaxed flex items-start gap-1.5">
          <Icon.Check size={12} className="mt-0.5 shrink-0" style={{ color: '#5a8a55' }} />
          All {totalTypes} item type{totalTypes === 1 ? '' : 's'} configured. Every schedule item has saved
          visibility.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-[var(--color-ink-3)] mb-2 leading-relaxed">
            {remaining.length} item type{remaining.length === 1 ? '' : 's'} still on the locked-by-default seed.
            Click one to jump to its first item.
          </p>
          <ul className="space-y-1">
            {remaining.map(({ type, items }) => (
              <li key={type}>
                <button
                  onClick={() => onJumpTo(items[0]!.id)}
                  className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-[3px] hover:bg-[var(--color-paper-2)]/70 transition-colors"
                >
                  <span className="text-[12.5px] font-semibold text-[var(--color-ink)] truncate">
                    {scheduleItemLabel(type as ScheduleItem['type'])}
                  </span>
                  <span className="text-[10.5px] font-mono text-[var(--color-ink-4)] shrink-0">
                    {items.length} item{items.length === 1 ? '' : 's'} →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
