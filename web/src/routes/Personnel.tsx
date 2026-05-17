import { useMemo, useState } from 'react';
import { useApp } from '@/state/AppState';
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

export function Personnel() {
  const { tour } = useApp();
  const [groupFilter, setGroupFilter] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');

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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" leading={<Icon.Document size={14} />}>
              Copy from prior tour
            </Button>
            <Button variant="outline" size="md" leading={<Icon.Plus size={14} />}>
              CSV import
            </Button>
            <Button variant="primary" size="md" leading={<Icon.Plus size={14} />}>
              Add person
            </Button>
          </div>
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
}: {
  member: TourPerson;
  group: Group;
  tags: { id: string; name: string }[];
  zebra: boolean;
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
        <button className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
          Edit
        </button>
      </td>
    </tr>
  );
}

function PersonCardRow({
  member,
  group,
  tags,
}: {
  member: TourPerson;
  group: Group;
  tags: { id: string; name: string }[];
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
      <button className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink)] shrink-0">
        Edit
      </button>
    </li>
  );
}
