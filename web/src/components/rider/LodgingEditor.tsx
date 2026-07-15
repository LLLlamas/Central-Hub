import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EditableText, EditableSelect } from '@/components/ui/EditableText';
import { Label, TagListEditor, RemoveRowButton } from '@/components/rider/shared';
import type { LodgingSpec, RoomingEntry, RoomType } from '@/types';

// Inline-editable authoring surface for a rider's Lodging section, used by
// RiderBuilder.tsx — replaced the old read-only LodgingReview (removed; see
// git history). Dumb controlled component: no manager/propose branching here,
// that stays in the parent (mirrors RiderBuilder's InputListReview pattern —
// value in, onChange out, parent decides how to persist/propose it, and
// `disabled` locks the whole surface the same way InputListReview/
// MonitorMixReview do once a section is marked complete).
//
// totalRooms/totalOccupants are derived from the rooming list (room count +
// summed occupants) on every commit rather than exposed as separately-editable
// fields — a free-standing number input could drift from the actual list;
// recomputing keeps every consumer of those fields accurate for free.

type Occupant = RoomingEntry['occupants'][number];
type HotelRequirements = NonNullable<LodgingSpec['hotelRequirements']>;

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'junior_suite', label: 'Junior suite' },
  { value: 'suite', label: 'Suite' },
];

const emptyOccupant = (): Occupant => ({ name: undefined, role: '' });
const nextRoomNumber = (rooms: RoomingEntry[]) => (rooms.length ? Math.max(...rooms.map((r) => r.roomNumber)) + 1 : 1);
const emptyRoom = (rooms: RoomingEntry[]): RoomingEntry => ({
  roomNumber: nextRoomNumber(rooms),
  roomType: 'single',
  occupants: [emptyOccupant()],
});

export function LodgingEditor({
  lodging,
  onChange,
  disabled,
}: {
  lodging: LodgingSpec | undefined;
  onChange: (next: LodgingSpec) => void;
  disabled: boolean;
}) {
  const rooms = lodging?.roomingList ?? [];
  const requirements = lodging?.hotelRequirements;
  const totalOccupants = rooms.reduce((sum, r) => sum + r.occupants.length, 0);

  const commit = (nextRooms: RoomingEntry[], nextRequirements = requirements) => {
    onChange({
      hotelRequirements: nextRequirements,
      roomingList: nextRooms,
      totalRooms: nextRooms.length,
      totalOccupants: nextRooms.reduce((sum, r) => sum + r.occupants.length, 0),
    });
  };

  const updateRoom = (i: number, patch: Partial<RoomingEntry>) => {
    commit(rooms.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRoom = () => commit([...rooms, emptyRoom(rooms)]);
  const removeRoom = (i: number) => commit(rooms.filter((_, idx) => idx !== i));

  const updateRequirements = (patch: Partial<HotelRequirements>) => {
    commit(rooms, { ...requirements, ...patch });
  };

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        {rooms.length} room{rooms.length === 1 ? '' : 's'}, {totalOccupants} occupant{totalOccupants === 1 ? '' : 's'}. Counts update automatically as rooms and occupants change.
      </p>

      <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-3">
        <div className="eyebrow">Hotel requirements</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Star rating (minimum)</Label>
            <EditableText
              value={String(requirements?.starRating ?? '')}
              mono
              disabled={disabled}
              placeholder="e.g. 4"
              onChange={(v) => updateRequirements({ starRating: v.trim() ? Number(v) || undefined : undefined })}
            />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-2)] self-end pb-1">
            <input
              type="checkbox"
              checked={!!requirements?.chainOnly}
              disabled={disabled}
              onChange={(e) => updateRequirements({ chainOnly: e.target.checked })}
              className="accent-[var(--color-ink)]"
            />
            Established chain only
          </label>
        </div>
        <div>
          <Label>Amenities required</Label>
          <TagListEditor
            tags={requirements?.amenitiesRequired ?? []}
            onChange={(v) => updateRequirements({ amenitiesRequired: v.length ? v : undefined })}
            placeholder="Add amenity"
            disabled={disabled}
          />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-2)]">
          <input
            type="checkbox"
            checked={!!requirements?.artistPreApproval}
            disabled={disabled}
            onChange={(e) => updateRequirements({ artistPreApproval: e.target.checked })}
            className="accent-[var(--color-ink)]"
          />
          Artist pre-approval required
        </label>
      </div>

      <div>
        <div className="eyebrow mb-2">Rooming list</div>
        <div className="space-y-2.5">
          {rooms.map((room, i) => (
            <RoomRow
              key={i}
              room={room}
              onChange={(patch) => updateRoom(i, patch)}
              onRemove={() => removeRoom(i)}
              disabled={disabled}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={addRoom} disabled={disabled} className="mt-2.5">
          Add room
        </Button>
      </div>
    </div>
  );
}

function RoomRow({
  room,
  onChange,
  onRemove,
  disabled,
}: {
  room: RoomingEntry;
  onChange: (patch: Partial<RoomingEntry>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const updateOccupant = (i: number, patch: Partial<Occupant>) => {
    onChange({ occupants: room.occupants.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  };
  const addOccupant = () => onChange({ occupants: [...room.occupants, emptyOccupant()] });
  const removeOccupant = (i: number) => onChange({ occupants: room.occupants.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-2.5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="w-full sm:w-20 shrink-0">
          <Label>Room #</Label>
          <EditableText
            value={String(room.roomNumber ?? '')}
            mono
            disabled={disabled}
            onChange={(v) => onChange({ roomNumber: Number(v) || 0 })}
          />
        </div>
        <div className="w-full sm:w-36 shrink-0">
          <Label>Room type</Label>
          <EditableSelect
            value={room.roomType}
            options={ROOM_TYPE_OPTIONS}
            disabled={disabled}
            onChange={(v) => onChange({ roomType: (v || 'single') as RoomType })}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Label>Occupants</Label>
          <div className="space-y-1">
            {room.occupants.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <EditableText
                  value={o.name ?? ''}
                  disabled={disabled}
                  placeholder="Name (optional)"
                  onChange={(v) => updateOccupant(i, { name: v || undefined })}
                  className="flex-1"
                />
                <EditableText
                  value={o.role}
                  disabled={disabled}
                  placeholder="Role"
                  onChange={(v) => updateOccupant(i, { role: v })}
                  className="flex-1 text-[var(--color-ink-3)]"
                />
                <RemoveRowButton onClick={() => removeOccupant(i)} disabled={disabled} title="Remove occupant" shrink />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={addOccupant} disabled={disabled} className="mt-1">
            Add occupant
          </Button>
        </div>
        <RemoveRowButton onClick={onRemove} disabled={disabled} title="Remove this room" size={12} shrink />
      </div>
    </div>
  );
}

