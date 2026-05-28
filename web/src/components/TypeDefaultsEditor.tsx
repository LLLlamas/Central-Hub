import { useState } from 'react';
import { useApp } from '@/state/AppState';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { VisibilityEditor } from '@/components/VisibilityEditor';
import { SCHEDULE_TYPE_OWNER } from '@/lib/visibilityDefaults';
import { scheduleItemLabel } from '@/lib/format';
import type { ScheduleItemType } from '@/types';

const TYPES_IN_ORDER: ScheduleItemType[] = [
  'load_in', 'soundcheck', 'doors', 'set', 'changeover', 'curfew', 'load_out',
  'bus_call', 'lobby_call',
  'breakfast', 'lunch', 'dinner',
  'press', 'meet_greet', 'rehearsal', 'other',
];

/**
 * Tour-level "Permissions by item type" editor. Sets the seed Visibility for
 * each ScheduleItemType — new items inherit it; existing items keep their
 * per-item overrides. Removes per-item permission work for the common case.
 */
export function TypeDefaultsEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tour, getScheduleTypeDefault, setScheduleTypeDefault, applyTypeTemplateToAllItems } = useApp();
  const [activeType, setActiveType] = useState<ScheduleItemType>('soundcheck');
  const [syncedNote, setSyncedNote] = useState<{ type: ScheduleItemType; count: number } | null>(null);
  const activeVis = getScheduleTypeDefault(activeType);
  const ownerGroupId = SCHEDULE_TYPE_OWNER[activeType];
  const ownerGroup = tour.groups.find((g) => g.id === ownerGroupId);
  const matchingCount = tour.scheduleItems.filter((i) => i.type === activeType).length;

  const handleSync = () => {
    const n = applyTypeTemplateToAllItems(activeType);
    setSyncedNote({ type: activeType, count: n });
  };

  return (
    <Modal open={open} onClose={onClose} eyebrow="Permissions" title="Defaults by item type" size="xl">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        Set the visibility once per item type. New schedule items pick up these defaults automatically.
        For items already on the calendar, use <em>Sync to all</em> to push the template down. Every
        type starts locked — only Management and Production can see or edit. The chip on the right shows
        the <em>suggested</em> owning group for each type; grant it explicitly when you want them to edit.
      </p>
      <div className="mt-4 grid md:grid-cols-[220px_1fr] gap-4">
        <ul className="border border-[var(--color-rule-soft)] rounded-[3px] divide-y divide-[var(--color-rule-soft)] max-h-[440px] overflow-y-auto">
          {TYPES_IN_ORDER.map((t) => {
            const vis = getScheduleTypeDefault(t);
            const owner = tour.groups.find((g) => g.id === SCHEDULE_TYPE_OWNER[t]);
            const active = t === activeType;
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setActiveType(t)}
                  className={`w-full text-left px-3 py-2 hover:bg-[var(--color-paper)]/60 ${active ? 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]' : ''}`}
                >
                  <div className="text-[12.5px] font-semibold">{scheduleItemLabel(t)}</div>
                  <div className={`text-[11px] ${active ? 'opacity-80' : 'text-[var(--color-ink-3)]'}`}>
                    {owner?.name ?? '—'} · default {vis.default}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[13px] font-semibold">{scheduleItemLabel(activeType)}</span>
            {ownerGroup && (
              <Chip tone="neutral" variant="outline" size="sm">
                Suggested owner: {ownerGroup.name}
              </Chip>
            )}
            <Chip tone="neutral" variant="outline" size="sm">
              {matchingCount} on calendar
            </Chip>
          </div>
          <VisibilityEditor
            value={activeVis}
            groups={tour.groups}
            tags={tour.groupTags}
            persons={tour.personnel}
            onChange={(v) => {
              setScheduleTypeDefault(activeType, v);
              // Editing the template invalidates any earlier "synced" note.
              if (syncedNote && syncedNote.type === activeType) setSyncedNote(null);
            }}
            compact
          />
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={matchingCount === 0}
              title={matchingCount === 0 ? 'No items of this type exist yet' : undefined}
            >
              Sync to all {matchingCount} existing item{matchingCount === 1 ? '' : 's'}
            </Button>
            {syncedNote && syncedNote.type === activeType && (
              <span className="text-[11.5px] text-[var(--color-ink-3)]">
                Applied to {syncedNote.count} item{syncedNote.count === 1 ? '' : 's'}.
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
