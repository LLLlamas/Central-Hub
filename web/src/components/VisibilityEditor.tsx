import { useState } from 'react';
import type { Visibility, VisibilityLevel, Group, GroupTag, TourPerson } from '@/types';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { visibilityLabel, visibilityDescription } from '@/lib/visibility';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const LEVELS: VisibilityLevel[] = ['blocked', 'sees', 'owns'];

const LEVEL_COLOR: Record<VisibilityLevel, string> = {
  blocked: 'var(--color-vis-blocked)',
  sees: 'var(--color-vis-sees)',
  owns: 'var(--color-vis-owns)',
};

interface Props {
  value: Visibility;
  groups: Group[];
  tags: GroupTag[];
  persons: TourPerson[];
  onChange: (v: Visibility) => void;
  compact?: boolean;
}

export function VisibilityEditor({ value, groups, tags, persons, onChange, compact }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const setDefault = (lvl: VisibilityLevel) => onChange({ ...value, default: lvl });
  const setGroup = (gid: string, lvl: VisibilityLevel | null) => {
    const groupsCopy = { ...(value.groups ?? {}) };
    if (lvl === null) delete groupsCopy[gid];
    else groupsCopy[gid] = lvl;
    onChange({ ...value, groups: groupsCopy });
  };
  const setTag = (tid: string, lvl: VisibilityLevel | null) => {
    const t = { ...(value.tags ?? {}) };
    if (lvl === null) delete t[tid];
    else t[tid] = lvl;
    onChange({ ...value, tags: t });
  };
  const setPerson = (pid: string, lvl: VisibilityLevel | null) => {
    const p = { ...(value.persons ?? {}) };
    if (lvl === null) delete p[pid];
    else p[pid] = lvl;
    onChange({ ...value, persons: p });
  };

  const overrideCount =
    Object.keys(value.groups ?? {}).length +
    Object.keys(value.tags ?? {}).length +
    Object.keys(value.persons ?? {}).length;

  return (
    <div className="border border-[var(--color-rule)] rounded-[3px] bg-[var(--color-card)]">
      {/* Default */}
      <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="eyebrow">Default for everyone</div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {visibilityDescription(value.default)}
            </div>
          </div>
          {overrideCount > 0 && (
            <Chip tone="neutral" variant="outline" size="sm">
              {overrideCount} override{overrideCount === 1 ? '' : 's'}
            </Chip>
          )}
        </div>
        <LevelPicker value={value.default} onChange={setDefault} />
      </div>

      {/* Group overrides */}
      {!compact && (
        <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
          <div className="eyebrow mb-2">Group overrides</div>
          <div className="space-y-1">
            {groups.map((g) => {
              const lvl = value.groups?.[g.id];
              const isOpen = openGroup === g.id;
              const groupTags = tags.filter((t) => t.groupId === g.id);
              const groupPersons = persons.filter((p) => p.groupId === g.id);
              const metaParts: string[] = [];
              if (groupPersons.length > 0)
                metaParts.push(`${groupPersons.length} ${groupPersons.length === 1 ? 'person' : 'people'}`);
              if (groupTags.length > 0)
                metaParts.push(`${groupTags.length} tag${groupTags.length === 1 ? '' : 's'}`);
              const expandable = groupPersons.length > 0 || groupTags.length > 0;
              return (
                <div key={g.id} className="border-b border-[var(--color-rule-soft)] last:border-0 -mx-1">
                  <div className="px-1 py-1.5 flex items-center gap-2">
                    <button
                      onClick={() => expandable && setOpenGroup(isOpen ? null : g.id)}
                      disabled={!expandable}
                      className="flex items-center gap-2 flex-1 text-left disabled:cursor-default"
                    >
                      <Icon.Chevron
                        size={11}
                        className={cn(
                          'text-[var(--color-ink-4)] transition-transform',
                          isOpen && 'rotate-90',
                          !expandable && 'opacity-30',
                        )}
                      />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />
                      <span className="text-[12.5px] font-semibold">{g.name}</span>
                      {metaParts.length > 0 && (
                        <span className="text-[10.5px] font-mono text-[var(--color-ink-4)]">
                          {metaParts.join(' · ')}
                        </span>
                      )}
                    </button>
                    <CompactPicker
                      value={lvl ?? null}
                      onChange={(l) => setGroup(g.id, l)}
                    />
                  </div>
                  {isOpen && (
                    <div className="pl-7 pb-2 space-y-1">
                      {groupTags.map((t) => {
                        const tlvl = value.tags?.[t.id];
                        return (
                          <div key={t.id} className="flex items-center gap-2">
                            <span className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)] flex-1">
                              ↳ {t.name}
                            </span>
                            <CompactPicker
                              value={tlvl ?? null}
                              onChange={(l) => setTag(t.id, l)}
                            />
                          </div>
                        );
                      })}
                      {groupPersons.map((p) => {
                        const plvl = value.persons?.[p.id];
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-mono font-bold text-[var(--color-paper)] bg-[var(--color-ink-2)] shrink-0"
                            >
                              {initials(p.person.name)}
                            </span>
                            <span className="text-[12px] flex-1 truncate">{p.person.name}</span>
                            <CompactPicker
                              value={plvl ?? null}
                              onChange={(l) => setPerson(p.id, l)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Person overrides (preview only — full editor would search persons) */}
      {!compact && Object.keys(value.persons ?? {}).length > 0 && (
        <div className="px-4 py-3">
          <div className="eyebrow mb-2">Person overrides</div>
          <div className="space-y-1">
            {Object.entries(value.persons!).map(([pid, lvl]) => {
              const p = persons.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <div key={pid} className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-mono font-bold text-[var(--color-paper)] bg-[var(--color-ink-2)]"
                  >
                    {initials(p.person.name)}
                  </span>
                  <span className="text-[12px] font-semibold flex-1">{p.person.name}</span>
                  <Chip tone="critical" size="sm">
                    {visibilityLabel(lvl)}
                  </Chip>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hierarchy hint */}
      <div className="px-4 py-2.5 bg-[var(--color-paper)]/60 border-t border-[var(--color-rule-soft)] text-[10.5px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
        Most specific wins · persons &gt; tags &gt; groups &gt; default
      </div>
    </div>
  );
}

function LevelPicker({
  value,
  onChange,
}: {
  value: VisibilityLevel;
  onChange: (l: VisibilityLevel) => void;
}) {
  return (
    <div className="inline-flex rounded-[3px] border border-[var(--color-rule)] overflow-hidden">
      {LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn(
            'px-3 h-7 text-[11px] font-mono font-semibold uppercase tracking-[0.06em] transition-colors border-r border-[var(--color-rule)] last:border-r-0',
            value === l
              ? 'text-[var(--color-paper)]'
              : 'text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)]',
          )}
          style={value === l ? { background: LEVEL_COLOR[l] } : undefined}
        >
          {visibilityLabel(l)}
        </button>
      ))}
    </div>
  );
}

function CompactPicker({
  value,
  onChange,
}: {
  value: VisibilityLevel | null;
  onChange: (l: VisibilityLevel | null) => void;
}) {
  return (
    <div className="inline-flex rounded-[3px] border border-[var(--color-rule)] overflow-hidden text-[10.5px]">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-2 h-6 font-mono font-semibold uppercase tracking-[0.06em] border-r border-[var(--color-rule)]',
          value === null ? 'bg-[var(--color-paper-2)] text-[var(--color-ink-2)]' : 'text-[var(--color-ink-4)] hover:bg-[var(--color-paper-2)]',
        )}
      >
        Inherit
      </button>
      {LEVELS.map((l, i) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={cn(
            'px-2 h-6 font-mono font-semibold uppercase tracking-[0.06em]',
            i < LEVELS.length - 1 && 'border-r border-[var(--color-rule)]',
            value === l ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)]',
          )}
          style={value === l ? { background: LEVEL_COLOR[l] } : undefined}
          title={visibilityLabel(l)}
        >
          {l[0]!.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
