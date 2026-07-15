import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EditableText, EditableSelect } from '@/components/ui/EditableText';
import { ExcludedBrandExplain } from '@/components/ExplainTag';
import { Label, TagListEditor, RemoveRowButton } from '@/components/rider/shared';
import { cn } from '@/lib/cn';
import type { CateringSpec, CateringMenu, CateringItem, MenuTime } from '@/types';

// Inline-editable authoring surface for a rider's Catering section, used by
// RiderBuilder.tsx — replaced the old read-only CateringReview (removed; see
// git history). Dumb controlled component: no manager/propose branching here,
// that stays in the parent (mirrors RiderBuilder's InputListReview pattern —
// value in, onChange out, parent decides how to persist/propose it, and
// `disabled` locks the whole surface the same way InputListReview/
// MonitorMixReview do once a section is marked complete).

const MENU_TIME_OPTIONS: { value: MenuTime; label: string }[] = [
  { value: 'load_in', label: 'Load-in' },
  { value: 'soundcheck', label: 'Soundcheck' },
  { value: 'show', label: 'Show' },
  { value: 'post_show', label: 'Post-show' },
];

const emptyItem = (): CateringItem => ({ item: '', qty: '' });
const emptyMenu = (): CateringMenu => ({ room: '', menuTime: 'show', items: [emptyItem()] });

export function CateringEditor({
  catering,
  onChange,
  disabled,
}: {
  catering: CateringSpec | undefined;
  onChange: (next: CateringSpec) => void;
  disabled: boolean;
}) {
  const menus = catering?.menus ?? [];
  const general = catering?.generalRequirements;

  const commit = (nextMenus: CateringMenu[], nextGeneral = general) => {
    onChange({ menus: nextMenus, generalRequirements: nextGeneral });
  };

  const updateMenu = (i: number, patch: Partial<CateringMenu>) => {
    commit(menus.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };

  const addMenu = () => commit([...menus, emptyMenu()]);
  const removeMenu = (i: number) => commit(menus.filter((_, idx) => idx !== i));

  const updateItem = (mi: number, ii: number, patch: Partial<CateringItem>) => {
    const items = menus[mi].items.map((it, idx) => (idx === ii ? { ...it, ...patch } : it));
    updateMenu(mi, { items });
  };

  const addItem = (mi: number) => updateMenu(mi, { items: [...menus[mi].items, emptyItem()] });
  const removeItem = (mi: number, ii: number) =>
    updateMenu(mi, { items: menus[mi].items.filter((_, idx) => idx !== ii) });

  const updateGeneral = (patch: Partial<NonNullable<CateringSpec['generalRequirements']>>) => {
    commit(menus, { ...general, ...patch });
  };

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        {menus.length} menu{menus.length === 1 ? '' : 's'} by room × time-of-day. Excluded brands are hard constraints — as important as what's requested.
      </p>

      {menus.map((menu, mi) => (
        <div key={mi} className="border border-[var(--color-rule-soft)] rounded-[3px] p-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3 pb-3 border-b border-[var(--color-rule-soft)]">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Room</Label>
                <EditableText
                  value={menu.room}
                  disabled={disabled}
                  placeholder="e.g. Dressing Room 1"
                  onChange={(v) => updateMenu(mi, { room: v })}
                />
              </div>
              <div>
                <Label>Menu time</Label>
                <EditableSelect
                  value={menu.menuTime}
                  options={MENU_TIME_OPTIONS}
                  disabled={disabled}
                  onChange={(v) => updateMenu(mi, { menuTime: v as MenuTime })}
                />
              </div>
              <div>
                <Label>Available by</Label>
                <EditableText
                  value={menu.availableBy ?? ''}
                  disabled={disabled}
                  placeholder="e.g. 5:00 PM"
                  onChange={(v) => updateMenu(mi, { availableBy: v || undefined })}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeMenu(mi)}
              disabled={disabled}
              title="Remove this menu"
              className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)] shrink-0 disabled:opacity-40 disabled:hover:text-[var(--color-ink-3)]"
            >
              <Icon.X size={11} /> Remove menu
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
              <thead className="bg-[var(--color-paper-2)]/40">
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                  <th className="px-2.5 py-2 min-w-[130px]">Item</th>
                  <th className="px-2.5 py-2 min-w-[100px]">English</th>
                  <th className="px-2.5 py-2 w-20">Qty</th>
                  <th className="px-2.5 py-2 w-20">Unit</th>
                  <th className="px-2.5 py-2 min-w-[130px]">Preferred brand</th>
                  <th className="px-2.5 py-2 min-w-[150px]">
                    Excluded brand <ExcludedBrandExplain section="catering" />
                  </th>
                  <th className="px-2.5 py-2 min-w-[120px]">Dietary tags</th>
                  <th className="px-2.5 py-2 min-w-[120px]">Notes</th>
                  <th className="px-2.5 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {menu.items.map((item, ii) => {
                  const hasExcl = (item.brandExcluded?.length ?? 0) > 0;
                  return (
                    <tr
                      key={ii}
                      className={cn('border-t border-[var(--color-rule-soft)]', hasExcl && 'bg-[rgba(184,57,43,0.04)]')}
                    >
                      <td className="px-1.5 py-1 align-top">
                        <EditableText value={item.item} disabled={disabled} onChange={(v) => updateItem(mi, ii, { item: v })} />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <EditableText
                          value={item.itemEn ?? ''}
                          disabled={disabled}
                          placeholder="—"
                          onChange={(v) => updateItem(mi, ii, { itemEn: v || undefined })}
                          className="text-[10.5px] italic text-[var(--color-ink-3)]"
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <EditableText
                          value={String(item.qty ?? '')}
                          disabled={disabled}
                          onChange={(v) => updateItem(mi, ii, { qty: v })}
                          className="font-mono"
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <EditableText
                          value={item.unit ?? ''}
                          disabled={disabled}
                          placeholder="—"
                          onChange={(v) => updateItem(mi, ii, { unit: v || undefined })}
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <TagListEditor
                          tags={item.brandPreferred ?? []}
                          onChange={(v) => updateItem(mi, ii, { brandPreferred: v.length ? v : undefined })}
                          placeholder="Add brand"
                          disabled={disabled}
                        />
                      </td>
                      <td className={cn('px-1.5 py-1 align-top rounded-[2px]', hasExcl && 'bg-[rgba(184,57,43,0.05)]')}>
                        <TagListEditor
                          tags={item.brandExcluded ?? []}
                          onChange={(v) => updateItem(mi, ii, { brandExcluded: v.length ? v : undefined })}
                          placeholder="Add excluded brand"
                          critical
                          disabled={disabled}
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <TagListEditor
                          tags={item.dietaryTags ?? []}
                          onChange={(v) => updateItem(mi, ii, { dietaryTags: v.length ? v : undefined })}
                          placeholder="Add tag"
                          disabled={disabled}
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <EditableText
                          value={item.notes ?? ''}
                          disabled={disabled}
                          placeholder="—"
                          onChange={(v) => updateItem(mi, ii, { notes: v || undefined })}
                          className="text-[11px] italic text-[var(--color-ink-3)]"
                        />
                      </td>
                      <td className="px-1.5 py-1 align-top text-center">
                        <RemoveRowButton onClick={() => removeItem(mi, ii)} disabled={disabled} title="Remove this item" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => addItem(mi)} disabled={disabled} className="mt-2">
            Add item
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={addMenu} disabled={disabled}>
        Add menu
      </Button>

      <div className="border-t border-[var(--color-rule-soft)] pt-3 space-y-2.5">
        <div className="eyebrow">General requirements</div>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-2)]">
          <input
            type="checkbox"
            checked={!!general?.biodegradableDisposables}
            disabled={disabled}
            onChange={(e) => updateGeneral({ biodegradableDisposables: e.target.checked })}
            className="accent-[var(--color-ink)]"
          />
          Biodegradable disposables required
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-2)]">
          <input
            type="checkbox"
            checked={!!general?.foodDonationPlanRequired}
            disabled={disabled}
            onChange={(e) => updateGeneral({ foodDonationPlanRequired: e.target.checked })}
            className="accent-[var(--color-ink)]"
          />
          Food donation plan required
        </label>
        <div>
          <Label>Other requirements</Label>
          <TagListEditor
            tags={general?.other ?? []}
            onChange={(v) => updateGeneral({ other: v.length ? v : undefined })}
            placeholder="Add a requirement"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

