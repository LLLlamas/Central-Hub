import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EditableText } from '@/components/ui/EditableText';
import { ExcludedBrandExplain } from '@/components/ExplainTag';
import { Label, TagListEditor, RemoveRowButton } from '@/components/rider/shared';
import { cn } from '@/lib/cn';
import type { BacklineSpec, BacklinePiece, BacklineHardware, BacklineBassOption } from '@/types';

// Inline-editable authoring surface for a rider's Backline section, used by
// RiderBuilder.tsx — replaced the old read-only BacklineReview (removed; see
// git history). Dumb controlled component: no manager/propose branching here,
// that stays in the parent (mirrors RiderBuilder's InputListReview pattern —
// value in, onChange out, parent decides how to persist/propose it, and
// `disabled` locks the whole surface the same way InputListReview/
// MonitorMixReview do once a section is marked complete). Every category is
// optional per BacklineSpec, so each one renders an "Add … section" affordance when absent and a
// "Remove" affordance when present, matching the authoring-first rider
// (sections can be added/removed/renamed).

type DrumsSpec = NonNullable<BacklineSpec['drums']>;
type BassSpec = NonNullable<BacklineSpec['bass']>;
type GuitarItem = NonNullable<BacklineSpec['guitar']>[number];
type MiscItem = NonNullable<BacklineSpec['miscellaneous']>[number];
type VideoScreenSpec = NonNullable<BacklineSpec['videoScreen']>;

const emptyDrums = (): DrumsSpec => ({ kitOptions: [], pieces: [], hardware: [] });
const emptyPiece = (): BacklinePiece => ({ type: '', size: '' });
const emptyHardware = (): BacklineHardware => ({ item: '', qty: 1 });
const nextBassOption = (options: BacklineBassOption[]): BacklineBassOption => ({
  optionNumber: options.length ? Math.max(...options.map((o) => o.optionNumber)) + 1 : 1,
  head: '',
  cab: '',
});
const emptyGuitar = (): GuitarItem => ({ item: '', qty: 1 });
const emptyMisc = (): MiscItem => ({ item: '', qty: 1 });
const emptyVideoScreen = (): VideoScreenSpec => ({
  type: '',
  dimensions: '',
  aspectRatio: '',
  resolutionPreferred: '',
  resolutionMin: '',
});

export function BacklineEditor({
  backline,
  onChange,
  disabled,
}: {
  backline: BacklineSpec | undefined;
  onChange: (next: BacklineSpec) => void;
  disabled: boolean;
}) {
  const spec: BacklineSpec = backline ?? {};
  const update = (patch: Partial<BacklineSpec>) => onChange({ ...spec, ...patch });

  return (
    <div className="space-y-4">
      <DrumsSection
        drums={spec.drums}
        onChange={(drums) => update({ drums })}
        onAdd={() => update({ drums: emptyDrums() })}
        onRemove={() => update({ drums: undefined })}
        disabled={disabled}
      />
      <BassSection
        bass={spec.bass}
        onChange={(bass) => update({ bass })}
        onAdd={() => update({ bass: { options: [nextBassOption([])] } })}
        onRemove={() => update({ bass: undefined })}
        disabled={disabled}
      />
      <GuitarSection
        guitar={spec.guitar}
        onChange={(guitar) => update({ guitar })}
        onAdd={() => update({ guitar: [emptyGuitar()] })}
        onRemove={() => update({ guitar: undefined })}
        disabled={disabled}
      />
      <MiscSection
        miscellaneous={spec.miscellaneous}
        onChange={(miscellaneous) => update({ miscellaneous })}
        onAdd={() => update({ miscellaneous: [emptyMisc()] })}
        onRemove={() => update({ miscellaneous: undefined })}
        disabled={disabled}
      />

      <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={!!spec.risersRequired}
            disabled={disabled}
            onChange={(e) => update({ risersRequired: e.target.checked })}
            className="accent-[var(--color-ink)]"
          />
          Risers required
        </label>
      </div>

      <VideoScreenSection
        videoScreen={spec.videoScreen}
        onChange={(videoScreen) => update({ videoScreen })}
        onAdd={() => update({ videoScreen: emptyVideoScreen() })}
        onRemove={() => update({ videoScreen: undefined })}
        disabled={disabled}
      />
    </div>
  );
}

// ---- Drums --------------------------------------------------

function DrumsSection({
  drums,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  drums: DrumsSpec | undefined;
  onChange: (next: DrumsSpec) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (!drums) {
    return (
      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={onAdd} disabled={disabled}>
        Add drums section
      </Button>
    );
  }

  const setKitOptions = (kitOptions: string[]) => onChange({ ...drums, kitOptions });
  const setPieces = (pieces: BacklinePiece[]) => onChange({ ...drums, pieces });
  const setHardware = (hardware: BacklineHardware[]) => onChange({ ...drums, hardware });

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-4">
      <SectionHeader title="Drums" onRemove={onRemove} removeLabel="Remove drums section" disabled={disabled} />

      <div>
        <Label>Kit options</Label>
        <div className="space-y-1">
          {drums.kitOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <EditableText
                value={opt}
                disabled={disabled}
                placeholder="e.g. Kit A — 22&quot; kick, 5-piece"
                onChange={(v) => setKitOptions(drums.kitOptions.map((o, idx) => (idx === i ? v : o)))}
              />
              <RemoveRowButton
                onClick={() => setKitOptions(drums.kitOptions.filter((_, idx) => idx !== i))}
                disabled={disabled}
                title="Remove option"
                shrink
              />
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => setKitOptions([...drums.kitOptions, ''])} disabled={disabled} className="mt-1">
          Add kit option
        </Button>
      </div>

      <div>
        <Label>Pieces</Label>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
            <thead className="bg-[var(--color-paper-2)]/40">
              <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                <th className="px-2.5 py-2 min-w-[130px]">Type</th>
                <th className="px-2.5 py-2 w-28">Size</th>
                <th className="px-2.5 py-2 min-w-[140px]">Notes</th>
                <th className="px-2.5 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {drums.pieces.map((p, i) => (
                <tr key={i} className="border-t border-[var(--color-rule-soft)]">
                  <td className="px-1.5 py-1 align-top">
                    <EditableText
                      value={p.type}
                      disabled={disabled}
                      onChange={(v) => setPieces(drums.pieces.map((x, idx) => (idx === i ? { ...x, type: v } : x)))}
                    />
                  </td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableText
                      value={p.size}
                      mono
                      disabled={disabled}
                      onChange={(v) => setPieces(drums.pieces.map((x, idx) => (idx === i ? { ...x, size: v } : x)))}
                    />
                  </td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableText
                      value={p.notes ?? ''}
                      placeholder="—"
                      disabled={disabled}
                      onChange={(v) => setPieces(drums.pieces.map((x, idx) => (idx === i ? { ...x, notes: v || undefined } : x)))}
                      className="text-[11px] italic text-[var(--color-ink-3)]"
                    />
                  </td>
                  <td className="px-1.5 py-1 align-top text-center">
                    <RemoveRowButton
                      onClick={() => setPieces(drums.pieces.filter((_, idx) => idx !== i))}
                      disabled={disabled}
                      title="Remove this piece"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => setPieces([...drums.pieces, emptyPiece()])} disabled={disabled} className="mt-2">
          Add piece
        </Button>
      </div>

      <div>
        <Label>Hardware</Label>
        <div className="space-y-2">
          {drums.hardware.map((h, i) => {
            const hasExcl = (h.excluded?.length ?? 0) > 0;
            const updateRow = (patch: Partial<BacklineHardware>) =>
              setHardware(drums.hardware.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
            return (
              <div
                key={i}
                className={cn(
                  'border rounded-[3px] p-2.5',
                  hasExcl ? 'border-[rgba(184,57,43,0.3)] bg-[rgba(184,57,43,0.03)]' : 'border-[var(--color-rule-soft)]',
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[2fr_auto] gap-3">
                    <div>
                      <Label>Item</Label>
                      <EditableText value={h.item} disabled={disabled} onChange={(v) => updateRow({ item: v })} />
                    </div>
                    <div className="w-20">
                      <Label>Qty</Label>
                      <EditableText
                        value={String(h.qty ?? '')}
                        mono
                        disabled={disabled}
                        onChange={(v) => updateRow({ qty: Number(v) || 1 })}
                      />
                    </div>
                  </div>
                  <RemoveRowButton
                    onClick={() => setHardware(drums.hardware.filter((_, idx) => idx !== i))}
                    disabled={disabled}
                    title="Remove this hardware line"
                    size={12}
                    shrink
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Preferred</Label>
                    <TagListEditor
                      tags={h.preferred ?? []}
                      onChange={(v) => updateRow({ preferred: v.length ? v : undefined })}
                      placeholder="Add preferred brand"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label>
                      Excluded <ExcludedBrandExplain section="backline" />
                    </Label>
                    <TagListEditor
                      tags={h.excluded ?? []}
                      onChange={(v) => updateRow({ excluded: v.length ? v : undefined })}
                      placeholder="Add excluded brand"
                      critical
                      disabled={disabled}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label>Notes</Label>
                  <EditableText
                    value={h.notes ?? ''}
                    placeholder="—"
                    disabled={disabled}
                    onChange={(v) => updateRow({ notes: v || undefined })}
                    className="text-[11px] italic text-[var(--color-ink-3)]"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => setHardware([...drums.hardware, emptyHardware()])} disabled={disabled} className="mt-2">
          Add hardware
        </Button>
      </div>
    </div>
  );
}

// ---- Bass ----------------------------------------------------

function BassSection({
  bass,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  bass: BassSpec | undefined;
  onChange: (next: BassSpec) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (!bass) {
    return (
      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={onAdd} disabled={disabled}>
        Add bass section
      </Button>
    );
  }

  const setOptions = (options: BacklineBassOption[]) => onChange({ options });

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-3">
      <SectionHeader title="Bass" onRemove={onRemove} removeLabel="Remove bass section" disabled={disabled} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-2.5 py-2 w-20">Option</th>
              <th className="px-2.5 py-2 min-w-[140px]">Head</th>
              <th className="px-2.5 py-2 min-w-[140px]">Cab</th>
              <th className="px-2.5 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {bass.options.map((o, i) => (
              <tr key={i} className="border-t border-[var(--color-rule-soft)]">
                <td className="px-1.5 py-1 align-top">
                  <EditableText
                    value={String(o.optionNumber ?? '')}
                    mono
                    disabled={disabled}
                    onChange={(v) => setOptions(bass.options.map((x, idx) => (idx === i ? { ...x, optionNumber: Number(v) || 1 } : x)))}
                  />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={o.head} disabled={disabled} onChange={(v) => setOptions(bass.options.map((x, idx) => (idx === i ? { ...x, head: v } : x)))} />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={o.cab} disabled={disabled} onChange={(v) => setOptions(bass.options.map((x, idx) => (idx === i ? { ...x, cab: v } : x)))} />
                </td>
                <td className="px-1.5 py-1 align-top text-center">
                  <RemoveRowButton
                    onClick={() => setOptions(bass.options.filter((_, idx) => idx !== i))}
                    disabled={disabled}
                    title="Remove this option"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => setOptions([...bass.options, nextBassOption(bass.options)])} disabled={disabled}>
        Add option
      </Button>
    </div>
  );
}

// ---- Guitar ----------------------------------------------------

function GuitarSection({
  guitar,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  guitar: BacklineSpec['guitar'];
  onChange: (next: NonNullable<BacklineSpec['guitar']>) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (!guitar) {
    return (
      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={onAdd} disabled={disabled}>
        Add guitar section
      </Button>
    );
  }

  const update = (i: number, patch: Partial<GuitarItem>) => onChange(guitar.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => onChange(guitar.filter((_, idx) => idx !== i));

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-3">
      <SectionHeader title="Guitar amps" onRemove={onRemove} removeLabel="Remove guitar section" disabled={disabled} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-2.5 py-2 min-w-[150px]">Item</th>
              <th className="px-2.5 py-2 w-20">Qty</th>
              <th className="px-2.5 py-2 min-w-[140px]">Notes</th>
              <th className="px-2.5 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {guitar.map((g, i) => (
              <tr key={i} className="border-t border-[var(--color-rule-soft)]">
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={g.item} disabled={disabled} onChange={(v) => update(i, { item: v })} />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={String(g.qty ?? '')} mono disabled={disabled} onChange={(v) => update(i, { qty: Number(v) || 1 })} />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText
                    value={g.notes ?? ''}
                    placeholder="—"
                    disabled={disabled}
                    onChange={(v) => update(i, { notes: v || undefined })}
                    className="text-[11px] italic text-[var(--color-ink-3)]"
                  />
                </td>
                <td className="px-1.5 py-1 align-top text-center">
                  <RemoveRowButton onClick={() => remove(i)} disabled={disabled} title="Remove this item" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => onChange([...guitar, emptyGuitar()])} disabled={disabled}>
        Add item
      </Button>
    </div>
  );
}

// ---- Miscellaneous ----------------------------------------------------

function MiscSection({
  miscellaneous,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  miscellaneous: BacklineSpec['miscellaneous'];
  onChange: (next: NonNullable<BacklineSpec['miscellaneous']>) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (!miscellaneous) {
    return (
      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={onAdd} disabled={disabled}>
        Add miscellaneous section
      </Button>
    );
  }

  const update = (i: number, patch: Partial<MiscItem>) => onChange(miscellaneous.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => onChange(miscellaneous.filter((_, idx) => idx !== i));

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-3">
      <SectionHeader title="Miscellaneous" onRemove={onRemove} removeLabel="Remove miscellaneous section" disabled={disabled} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-2.5 py-2 min-w-[150px]">Item</th>
              <th className="px-2.5 py-2 w-20">Qty</th>
              <th className="px-2.5 py-2 min-w-[130px]">Preferred brand</th>
              <th className="px-2.5 py-2 min-w-[140px]">Notes</th>
              <th className="px-2.5 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {miscellaneous.map((m, i) => (
              <tr key={i} className="border-t border-[var(--color-rule-soft)]">
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={m.item} disabled={disabled} onChange={(v) => update(i, { item: v })} />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText value={String(m.qty ?? '')} mono disabled={disabled} onChange={(v) => update(i, { qty: Number(v) || 1 })} />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText
                    value={m.brandPreferred ?? ''}
                    placeholder="—"
                    disabled={disabled}
                    onChange={(v) => update(i, { brandPreferred: v || undefined })}
                  />
                </td>
                <td className="px-1.5 py-1 align-top">
                  <EditableText
                    value={m.notes ?? ''}
                    placeholder="—"
                    disabled={disabled}
                    onChange={(v) => update(i, { notes: v || undefined })}
                    className="text-[11px] italic text-[var(--color-ink-3)]"
                  />
                </td>
                <td className="px-1.5 py-1 align-top text-center">
                  <RemoveRowButton onClick={() => remove(i)} disabled={disabled} title="Remove this item" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" leading={<Icon.Plus size={12} />} onClick={() => onChange([...miscellaneous, emptyMisc()])} disabled={disabled}>
        Add item
      </Button>
    </div>
  );
}

// ---- Video screen ----------------------------------------------------

function VideoScreenSection({
  videoScreen,
  onChange,
  onAdd,
  onRemove,
  disabled,
}: {
  videoScreen: VideoScreenSpec | undefined;
  onChange: (next: VideoScreenSpec) => void;
  onAdd: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  if (!videoScreen) {
    return (
      <Button variant="outline" size="sm" leading={<Icon.Plus size={12} />} onClick={onAdd} disabled={disabled}>
        Add video screen spec
      </Button>
    );
  }

  const update = (patch: Partial<VideoScreenSpec>) => onChange({ ...videoScreen, ...patch });

  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] p-3 space-y-3">
      <SectionHeader title="Video screen" onRemove={onRemove} removeLabel="Remove video screen spec" disabled={disabled} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <EditableText value={videoScreen.type} disabled={disabled} onChange={(v) => update({ type: v })} />
        </div>
        <div>
          <Label>Dimensions</Label>
          <EditableText value={videoScreen.dimensions} disabled={disabled} onChange={(v) => update({ dimensions: v })} />
        </div>
        <div>
          <Label>Aspect ratio</Label>
          <EditableText value={videoScreen.aspectRatio} disabled={disabled} onChange={(v) => update({ aspectRatio: v })} />
        </div>
        <div>
          <Label>Preferred resolution</Label>
          <EditableText value={videoScreen.resolutionPreferred} disabled={disabled} onChange={(v) => update({ resolutionPreferred: v })} />
        </div>
        <div>
          <Label>Minimum resolution</Label>
          <EditableText value={videoScreen.resolutionMin} disabled={disabled} onChange={(v) => update({ resolutionMin: v })} />
        </div>
      </div>
    </div>
  );
}

// ---- Shared bits ----------------------------------------------------

function SectionHeader({
  title,
  onRemove,
  removeLabel,
  disabled,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--color-rule-soft)]">
      <h4 className="font-display text-[15px] font-bold text-[var(--color-ink)]">{title}</h4>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title={removeLabel}
        className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)] shrink-0 disabled:opacity-40 disabled:hover:text-[var(--color-ink-3)]"
      >
        <Icon.X size={11} /> Remove
      </button>
    </div>
  );
}

