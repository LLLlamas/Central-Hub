import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '@/state/AppState';
import type { TourPersonInit } from '@/state/AppState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockTag } from '@/components/provenance/MockTag';
import { PersonName } from '@/components/provenance/PersonName';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { TourPerson, Group } from '@/types';

// Preset palette for new groups — picked to read well as the small dot/avatar
// fills in the roster. Same family as the seeded group colors.
const GROUP_COLORS = [
  '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#84cc16',
];

export function Personnel() {
  const { tour, user } = useApp();
  const [groupFilter, setGroupFilter] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  // null = closed; { id } = edit that person; 'new' = add a person.
  const [personModal, setPersonModal] = useState<{ id: string } | 'new' | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  // Management/Production gate the editing affordances — non-managers view only.
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';

  const filtered = useMemo(() => {
    let p = tour.personnel;
    if (groupFilter !== 'all') p = p.filter((m) => m.groupId === groupFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      p = p.filter(
        (m) =>
          m.person.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }
    return p;
  }, [tour.personnel, groupFilter, query]);

  const groupsWithCounts = useMemo(
    () =>
      tour.groups.map((g) => ({
        ...g,
        count: tour.personnel.filter((p) => p.groupId === g.id).length,
      })),
    [tour.groups, tour.personnel],
  );

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title={
          <>
            People and groups
          </>
        }
        description="The crew roster grouped by department, with placeholders clearly marked until real crew names land."
        meta={
          <div className="flex items-center gap-2 text-[12px] text-[var(--color-ink-3)]">
            <span>
              {tour.personnel.filter((p) => !p.isPlaceholder).length} named ·{' '}
              {tour.personnel.filter((p) => p.isPlaceholder).length} placeholder
            </span>
            <MockTag source="tour_person" field="Crew roster" />
          </div>
        }
        actions={
          managerView && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="md" leading={<Icon.Plus size={14} />}>
                CSV import
              </Button>
              <Button
                variant="primary"
                size="md"
                leading={<Icon.Plus size={14} />}
                onClick={() => setPersonModal('new')}
              >
                Add person
              </Button>
            </div>
          )
        }
      />

      {/* Groups overview — clickable filter */}
      <div className="mb-6">
        <div className="eyebrow mb-2">Groups</div>
        <div className="flex flex-wrap gap-2">
          <GroupChip
            active={groupFilter === 'all'}
            onClick={() => setGroupFilter('all')}
            color="var(--color-ink)"
            name="All"
            count={tour.personnel.length}
          />
          {groupsWithCounts.map((g) => (
            <GroupChip
              key={g.id}
              active={groupFilter === g.id}
              onClick={() => setGroupFilter(g.id)}
              color={g.color}
              name={g.name}
              count={g.count}
            />
          ))}
          {managerView && (
            <button
              onClick={() => setGroupModalOpen(true)}
              title="Add a group"
              className="inline-flex items-center justify-center w-8 h-8 rounded-[3px] border border-dashed border-[var(--color-rule)] text-[var(--color-ink-3)] hover:border-[var(--color-ink-4)] hover:text-[var(--color-ink)] transition-colors"
            >
              <Icon.Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search + table */}
      <Card padded={false}>
        <div className="px-5 py-3.5 border-b border-[var(--color-rule-soft)] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-4)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or role…"
              className="w-full h-9 pl-8 pr-3 text-[13px] rounded-[3px] bg-[var(--color-paper-2)]/70 border border-transparent focus:border-[var(--color-rule)] focus:bg-[var(--color-card)] outline-none"
            />
          </div>
          <div className="text-[12px] text-[var(--color-ink-3)] tabular">
            {filtered.length} of {tour.personnel.length}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No matches" hint="Adjust your filter or search query." />
          </div>
        ) : (
          <>
          <table className="hidden md:table w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)] border-b border-[var(--color-rule-soft)]">
                <th className="py-2 px-5">Person</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Group</th>
                <th className="py-2 px-3">Tags</th>
                <th className="py-2 px-3">Dates</th>
                <th className="py-2 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <PersonRow
                  key={m.id}
                  member={m}
                  group={tour.groups.find((g) => g.id === m.groupId)!}
                  tags={tour.groupTags.filter((t) => m.tagIds.includes(t.id))}
                  zebra={idx % 2 === 1}
                  onEdit={managerView ? () => setPersonModal({ id: m.id }) : undefined}
                />
              ))}
            </tbody>
          </table>
          <ul className="md:hidden divide-y divide-[var(--color-rule-soft)]">
            {filtered.map((m) => (
              <PersonCardRow
                key={m.id}
                member={m}
                group={tour.groups.find((g) => g.id === m.groupId)!}
                tags={tour.groupTags.filter((t) => m.tagIds.includes(t.id))}
                onEdit={managerView ? () => setPersonModal({ id: m.id }) : undefined}
              />
            ))}
          </ul>
          </>
        )}
      </Card>

      <DataSourcesPanel
        sourceKeys={['tour_person', 'person', 'group', 'group_tag', 'visibility']}
        intro="Personnel is a tour-scoped projection of two underlying global tables — Person (reused across tours) and Group (per-tour, almost always copied). TourPerson is the linker, with role + dates + tags. In v1: manual entry, CSV import, or copy-from-previous-tour."
      />

      {personModal && (
        <PersonModal
          member={personModal === 'new' ? undefined : tour.personnel.find((p) => p.id === personModal.id)}
          onClose={() => setPersonModal(null)}
        />
      )}
      {groupModalOpen && <GroupModal onClose={() => setGroupModalOpen(false)} />}
    </div>
  );
}

function GroupChip({
  active,
  onClick,
  color,
  name,
  count,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  name: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-[3px] border text-[12px] font-semibold transition-colors',
        active
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
          : 'border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-4)]',
      )}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {name}
      <span
        className={cn(
          'font-mono text-[10.5px] tabular',
          active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-4)]',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function PersonRow({
  member,
  group,
  tags,
  zebra,
  onEdit,
}: {
  member: TourPerson;
  group: Group;
  tags: { id: string; name: string }[];
  zebra: boolean;
  onEdit?: () => void;
}) {
  return (
    <tr className={cn('border-b border-[var(--color-rule-soft)] last:border-0', zebra && 'bg-[var(--color-paper)]/40')}>
      <td className="py-2.5 px-5">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-mono font-bold text-[var(--color-paper)]',
              member.isPlaceholder && 'opacity-60',
            )}
            style={{ background: group.color }}
          >
            {member.isPlaceholder ? '?' : initials(member.person.name)}
          </span>
          <PersonName person={member} />
        </div>
      </td>
      <td className="py-2.5 px-3 text-[var(--color-ink-2)]">{member.role}</td>
      <td className="py-2.5 px-3">
        <Chip size="sm" tone="neutral">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
          {group.name}
        </Chip>
      </td>
      <td className="py-2.5 px-3">
        {tags.length === 0 ? (
          <span className="text-[11px] text-[var(--color-ink-4)]">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t.id}
                className="px-1.5 py-[1px] text-[10px] font-mono uppercase tracking-[0.06em] rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-ink-3)]"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 font-mono text-[11.5px] tabular text-[var(--color-ink-3)]">
        {member.startDate} → {member.endDate}
      </td>
      <td className="py-2.5 px-5 text-right">
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

function PersonCardRow({
  member,
  group,
  tags,
  onEdit,
}: {
  member: TourPerson;
  group: Group;
  tags: { id: string; name: string }[];
  onEdit?: () => void;
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-full text-[11px] font-mono font-bold text-[var(--color-paper)] shrink-0',
          member.isPlaceholder && 'opacity-60',
        )}
        style={{ background: group.color }}
      >
        {member.isPlaceholder ? '?' : initials(member.person.name)}
      </span>
      <div className="flex-1 min-w-0">
        <PersonName person={member} />
        <div className="text-[12.5px] text-[var(--color-ink-2)]">{member.role}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip size="sm" tone="neutral">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
            {group.name}
          </Chip>
          {tags.map((t) => (
            <span
              key={t.id}
              className="px-1.5 py-[1px] text-[10px] font-mono uppercase tracking-[0.06em] rounded-[2px] bg-[var(--color-paper-2)] text-[var(--color-ink-3)]"
            >
              {t.name}
            </span>
          ))}
        </div>
        <div className="mt-1.5 font-mono text-[11px] tabular text-[var(--color-ink-4)]">
          {member.startDate} → {member.endDate}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)] shrink-0"
        >
          Edit
        </button>
      )}
    </li>
  );
}

const inputClass =
  'w-full h-9 px-2.5 text-[13px] rounded-[3px] bg-[var(--color-paper-2)]/70 border border-transparent focus:border-[var(--color-rule)] focus:bg-[var(--color-card)] outline-none';

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-1.5">{children}</div>;
}

/** Add (member undefined) or edit a TourPerson. */
function PersonModal({ member, onClose }: { member?: TourPerson; onClose: () => void }) {
  const { tour, addTourPerson, updateTourPerson, removeTourPerson } = useApp();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState(member?.person.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [groupId, setGroupId] = useState(member?.groupId ?? tour.groups[0]?.id ?? '');
  const [tagIds, setTagIds] = useState<string[]>(member?.tagIds ?? []);
  const [startDate, setStartDate] = useState(member?.startDate ?? '');
  const [endDate, setEndDate] = useState(member?.endDate ?? '');

  const groupTags = tour.groupTags.filter((t) => t.groupId === groupId);
  const canSave = name.trim().length > 0;

  const onChangeGroup = (gid: string) => {
    setGroupId(gid);
    // Tags belong to a group — drop any that aren't valid under the new one.
    setTagIds((prev) => prev.filter((id) => tour.groupTags.some((t) => t.id === id && t.groupId === gid)));
  };

  const save = () => {
    if (!canSave) return;
    const patch: TourPersonInit = {
      name: name.trim(),
      role: role.trim(),
      groupId,
      tagIds,
      startDate: startDate.trim() || undefined,
      endDate: endDate.trim() || undefined,
    };
    if (member) updateTourPerson(member.id, patch);
    else addTourPerson(patch);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={member ? 'Edit person' : 'Add person'}
      title={member ? member.person.name : 'New person'}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="FOH Engineer"
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Group</FieldLabel>
          <select value={groupId} onChange={(e) => onChangeGroup(e.target.value)} className={inputClass}>
            {tour.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Tags</FieldLabel>
          {groupTags.length === 0 ? (
            <div className="text-[12px] text-[var(--color-ink-4)] italic">No tags for this group.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {groupTags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setTagIds((prev) => (on ? prev.filter((id) => id !== t.id) : [...prev, t.id]))
                    }
                    className={cn(
                      'px-2 py-1 text-[11px] font-mono uppercase tracking-[0.06em] rounded-[3px] border transition-colors',
                      on
                        ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
                        : 'border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink-3)] hover:border-[var(--color-ink-4)]',
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start date</FieldLabel>
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              className={cn(inputClass, 'font-mono tabular')}
            />
          </div>
          <div>
            <FieldLabel>End date</FieldLabel>
            <input
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              className={cn(inputClass, 'font-mono tabular')}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {member ? (
            confirmRemove ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--color-accent)] font-semibold">Remove?</span>
                <button
                  onClick={() => {
                    removeTourPerson(member.id);
                    onClose();
                  }}
                  className="text-[12px] font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Yes, remove
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="text-[12px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
                title="Remove from this tour. To revoke app sign-in access, use App User Permissions."
              >
                Remove from tour
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!canSave}>
              {member ? 'Save' : 'Add person'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Add a new Group with a name + a preset color. */
function GroupModal({ onClose }: { onClose: () => void }) {
  const { addGroup } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    addGroup(name.trim(), color);
    onClose();
  };

  return (
    <Modal open onClose={onClose} eyebrow="Add group" title="New group">
      <div className="space-y-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Catering, Security…"
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>Color</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Pick ${c}`}
                className={cn(
                  'w-7 h-7 rounded-full transition-transform',
                  color === c
                    ? 'ring-2 ring-offset-2 ring-[var(--color-ink)] ring-offset-[var(--color-card)]'
                    : 'hover:scale-110',
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            Add group
          </Button>
        </div>
      </div>
    </Modal>
  );
}
