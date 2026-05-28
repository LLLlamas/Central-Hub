import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { useApp } from '@/state/AppState';
import type { FlightImport, FlightPassengerResolution } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  imp: FlightImport;
}

/**
 * Resolve every unmatched passenger on a flight import before approve.
 *
 * Per row, the reviewer picks one of:
 *   - Assign to an existing roster person   (the common spelling/legal-name case)
 *   - Add as a new roster person            (a real new person — sub, late hire)
 *   - Skip                                  (one-off non-roster traveller)
 *
 * The choice is stored in AppState (`flightPassengerResolutions`); the commit
 * step applies it when the user hits "Approve & import".
 */
export function ResolveUnmatchedModal({ open, onClose, imp }: Props) {
  const { tour, getFlightPassengerResolution, setFlightPassengerResolution } = useApp();

  const unmatchedNames = useMemo(() => {
    const set = new Set<string>();
    imp.parsedFlights.forEach((pf) =>
      pf.passengers.forEach((p) => {
        if (!p.matchedTourPersonId) set.add(p.name);
      }),
    );
    return [...set];
  }, [imp]);

  // Local draft — saved into AppState on "Save".
  const initial = useMemo<Record<string, FlightPassengerResolution>>(() => {
    const out: Record<string, FlightPassengerResolution> = {};
    unmatchedNames.forEach((n) => {
      const r = getFlightPassengerResolution(imp.id, n);
      out[n] = r ?? { action: 'skip' };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imp.id, unmatchedNames.join('|')]);
  const [draft, setDraft] = useState<Record<string, FlightPassengerResolution>>(initial);

  const update = (name: string, patch: Partial<FlightPassengerResolution>) =>
    setDraft((d) => ({ ...d, [name]: { ...d[name], ...patch } as FlightPassengerResolution }));

  const handleSave = () => {
    for (const name of unmatchedNames) {
      setFlightPassengerResolution(imp.id, name, draft[name]);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Flight import"
      title={`Resolve ${unmatchedNames.length} unmatched passenger${unmatchedNames.length === 1 ? '' : 's'}`}
      size="lg"
    >
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        Each row didn't match anyone on the roster. Pick how to land them — assign
        to an existing person if the name is just spelled differently, add a new
        person if they really aren't on the roster yet, or skip if they shouldn't
        be tracked.
      </p>
      <ul className="mt-4 border border-[var(--color-rule-soft)] rounded-[3px] divide-y divide-[var(--color-rule-soft)] max-h-[400px] overflow-y-auto">
        {unmatchedNames.map((name) => {
          const d = draft[name];
          return (
            <li key={name} className="px-4 py-3 grid md:grid-cols-[1fr_auto_auto] items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon.Alert size={12} className="text-[var(--color-day-rehearsal)] shrink-0" />
                <span className="text-[13px] font-semibold truncate">{name}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {(['assign', 'add', 'skip'] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() =>
                      update(name, { action: act, tourPersonId: act === 'assign' ? d?.tourPersonId : undefined })
                    }
                    className="cursor-pointer"
                  >
                    <Chip
                      tone={d?.action === act ? 'success' : 'neutral'}
                      variant={d?.action === act ? 'soft' : 'outline'}
                      size="sm"
                    >
                      {act === 'assign' ? 'Assign' : act === 'add' ? 'Add new' : 'Skip'}
                    </Chip>
                  </button>
                ))}
              </div>

              {d?.action === 'assign' ? (
                <select
                  value={d.tourPersonId ?? ''}
                  onChange={(e) => update(name, { tourPersonId: e.target.value })}
                  className="text-[12.5px] border border-[var(--color-rule)] rounded-[3px] px-2 py-1 bg-[var(--color-paper)] focus:outline-none focus:border-[var(--color-ink-3)] min-w-[180px]"
                >
                  <option value="">— pick a person —</option>
                  {tour.personnel.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.person.name}
                      {tp.role ? ` · ${tp.role}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[11.5px] text-[var(--color-ink-4)] italic">
                  {d?.action === 'add'
                    ? 'will be added to roster'
                    : 'will not appear on the Travel record'}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={Object.entries(draft).some(
            ([, r]) => r.action === 'assign' && !r.tourPersonId,
          )}
        >
          Save resolutions
        </Button>
      </div>
    </Modal>
  );
}
