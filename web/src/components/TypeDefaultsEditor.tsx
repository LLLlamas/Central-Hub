import { useState } from 'react';
import { useApp } from '@/state/AppState';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
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
  const { tour, getScheduleTypeDefault, setScheduleTypeDefault } = useApp();
  const [activeType, setActiveType] = useState<ScheduleItemType>('soundcheck');
  const activeVis = getScheduleTypeDefault(activeType);
  const ownerGroupId = SCHEDULE_TYPE_OWNER[activeType];
  const ownerGroup = tour.groups.find((g) => g.id === ownerGroupId);

  return (
    <Modal open={open} onClose={onClose} eyebrow="Permissions" title="Defaults by item type" size="xl">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        Set the visibility once per item type. New schedule items inherit these defaults; per-item edits override.
        The owning group (shown in bold) automatically gets <em>owns</em>.
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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-semibold">{scheduleItemLabel(activeType)}</span>
            {ownerGroup && (
              <Chip tone="success" variant="outline" size="sm">
                <Icon.Check size={10} /> Owner: {ownerGroup.name}
              </Chip>
            )}
          </div>
          <VisibilityEditor
            value={activeVis}
            groups={tour.groups}
            tags={tour.groupTags}
            persons={tour.personnel}
            onChange={(v) => setScheduleTypeDefault(activeType, v)}
            compact
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
