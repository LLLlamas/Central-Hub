import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { MockTag } from '@/components/provenance/MockTag';
import { usePdfViewer } from '@/components/PdfViewer';
import { fmtDate } from '@/lib/format';
import type { GearCategory, GearItem, GearStatus, GearProvidedBy, Travel, Hotel } from '@/types';

// ─── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<GearCategory, { label: string; icon: string }> = {
  audio_mics:      { label: 'Mics & DI',       icon: '🎙' },
  audio_monitors:  { label: 'Monitors & IEMs',  icon: '🎧' },
  backline_drums:  { label: 'Drums',             icon: '🥁' },
  backline_bass:   { label: 'Bass',              icon: '🎸' },
  backline_guitar: { label: 'Guitar',            icon: '🎸' },
  backline_keys:   { label: 'Keys',              icon: '🎹' },
  backline_other:  { label: 'Backline misc',     icon: '🎛' },
  lighting:        { label: 'Lighting',          icon: '💡' },
  video:           { label: 'Video / LED',       icon: '📺' },
  dressing_room:   { label: 'Dressing rooms',    icon: '🚪' },
  catering:        { label: 'Catering',          icon: '🍽' },
  production:      { label: 'Production',        icon: '🏗' },
  other:           { label: 'Other',             icon: '📦' },
};

const CATEGORY_ORDER: GearCategory[] = [
  'audio_mics', 'audio_monitors',
  'backline_drums', 'backline_bass', 'backline_guitar', 'backline_keys', 'backline_other',
  'lighting', 'video',
  'dressing_room', 'catering',
  'production', 'other',
];

// ─── Status metadata ──────────────────────────────────────────────────────────

type StatusFilter = GearStatus | 'all';

const STATUS_META: Record<GearStatus, { label: string; color: string; bg: string; dot: string }> = {
  needed:       { label: 'Needed',       color: 'text-[#b45309]',  bg: 'bg-amber-50',   dot: '#d97706' },
  sourced:      { label: 'Sourced',      color: 'text-[#1d4ed8]',  bg: 'bg-blue-50',    dot: '#3b82f6' },
  confirmed:    { label: 'Confirmed',    color: 'text-[#15803d]',  bg: 'bg-green-50',   dot: '#22c55e' },
  not_required: { label: 'Not required', color: 'text-[#6b7280]',  bg: 'bg-gray-50',    dot: '#9ca3af' },
};

const PROVIDER_LABELS: Record<GearProvidedBy, string> = {
  venue:    'Venue',
  touring:  'Touring',
  rental:   'Rental',
  purchase: 'Purchase',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GearStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold', m.bg, m.color)}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function CostCell({ cost, qty }: { cost?: number; qty: number }) {
  if (cost === undefined) return <span className="text-[var(--color-ink-4)]">—</span>;
  const total = cost * qty;
  return (
    <div className="text-right">
      <div className="font-mono text-[12px]">${total.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
      {qty > 1 && (
        <div className="text-[10px] text-[var(--color-ink-4)] font-mono">${cost}/ea</div>
      )}
    </div>
  );
}

// ─── Add / Edit item modal ────────────────────────────────────────────────────

interface ItemModalProps {
  item?: GearItem;
  onSave: (patch: Omit<GearItem, 'id'>) => void;
  onClose: () => void;
}

function ItemModal({ item, onSave, onClose }: ItemModalProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [qty, setQty] = useState(String(item?.quantity ?? 1));
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [category, setCategory] = useState<GearCategory>(item?.category ?? 'other');
  const [status, setStatus] = useState<GearStatus>(item?.status ?? 'needed');
  const [providedBy, setProvidedBy] = useState<GearProvidedBy | ''>(item?.providedBy ?? '');
  const [cost, setCost] = useState(item?.estimatedCost !== undefined ? String(item.estimatedCost) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  const isNew = !item;
  const canSave = name.trim().length > 0 && Number(qty) > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      quantity: Number(qty) || 1,
      unit: unit.trim() || undefined,
      category,
      status,
      providedBy: providedBy || undefined,
      estimatedCost: cost !== '' ? Number(cost) : undefined,
      notes: notes.trim() || undefined,
      fromRider: item?.fromRider ?? false,
      riderSection: item?.riderSection,
      riderPage: item?.riderPage,
    });
    onClose();
  }

  const inputCls = 'w-full px-2.5 py-1.5 rounded border border-[var(--color-rule)] bg-[var(--color-paper)] text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink-3)]';
  const labelCls = 'block text-[11px] font-semibold text-[var(--color-ink-3)] mb-1';

  return (
    <Modal open title={isNew ? 'Add item' : 'Edit item'} size="md" onClose={onClose}>
      <div className="space-y-3 p-1">
        <div>
          <label className={labelCls}>Item name *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shure SM58" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Quantity *</label>
            <input type="number" min="1" className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Unit (optional)</label>
            <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="each, pair, box…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as GearCategory)}>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as GearStatus)}>
              {(Object.keys(STATUS_META) as GearStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Provided by</label>
            <select className={inputCls} value={providedBy} onChange={(e) => setProvidedBy(e.target.value as GearProvidedBy | '')}>
              <option value="">Unknown</option>
              {(Object.keys(PROVIDER_LABELS) as GearProvidedBy[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Est. cost per unit ($)</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brands, exclusions, special requirements…" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            {isNew ? 'Add item' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({ item, onConfirm, onClose }: { item: GearItem; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open title="Remove item?" size="sm" onClose={onClose}>
      <p className="text-[13px] text-[var(--color-ink-2)] mb-4">
        Remove <strong>{item.name}</strong> from the gear list? This cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Remove</Button>
      </div>
    </Modal>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: GearItem;
  managerView: boolean;
  pdfUrl?: string;
  onEdit: (item: GearItem) => void;
  onDelete: (item: GearItem) => void;
  onStatusCycle: (item: GearItem) => void;
}

const STATUS_CYCLE: GearStatus[] = ['needed', 'sourced', 'confirmed', 'not_required'];

function ItemRow({ item, managerView, pdfUrl, onEdit, onDelete, onStatusCycle }: ItemRowProps) {
  const { openPdf } = usePdfViewer();
  return (
    <tr className="border-b border-[var(--color-rule-soft)] last:border-0 hover:bg-[var(--color-paper-2)] group">
      {/* Status — manager can click to cycle; others read-only */}
      <td className="py-2 pl-3 pr-2 w-[120px]">
        {managerView ? (
          <button onClick={() => onStatusCycle(item)} title="Click to change status">
            <StatusBadge status={item.status} />
          </button>
        ) : (
          <StatusBadge status={item.status} />
        )}
      </td>
      {/* Name + notes */}
      <td className="py-2 px-2">
        <div className="text-[13px] font-medium text-[var(--color-ink)]">{item.name}</div>
        {item.notes && (
          <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5 leading-snug">{item.notes}</div>
        )}
        {item.fromRider && item.riderPage && pdfUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); openPdf({ url: pdfUrl, page: item.riderPage, title: 'Rider' }); }}
            className="mt-0.5 inline-block text-[10px] text-[var(--color-ink-4)] font-mono hover:text-[var(--color-ink-2)] hover:underline"
          >
            p.{item.riderPage}
          </button>
        )}
        {item.fromRider && item.riderPage && !pdfUrl && (
          <span className="mt-0.5 inline-block text-[10px] text-[var(--color-ink-4)] font-mono">
            p.{item.riderPage}
          </span>
        )}
      </td>
      {/* Qty */}
      <td className="py-2 px-2 text-center w-[60px]">
        <span className="font-mono text-[12px]">{item.quantity}</span>
        {item.unit && <span className="text-[10px] text-[var(--color-ink-4)] ml-0.5">{item.unit}</span>}
      </td>
      {/* Provided by */}
      <td className="py-2 px-2 w-[90px]">
        {item.providedBy ? (
          <span className="text-[11px] text-[var(--color-ink-3)] font-medium">
            {PROVIDER_LABELS[item.providedBy]}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--color-ink-4)]">—</span>
        )}
      </td>
      {/* Est. cost */}
      <td className="py-2 px-2 w-[90px]">
        <CostCell cost={item.estimatedCost} qty={item.quantity} />
      </td>
      {/* Actions — manager only */}
      <td className="py-2 pl-2 pr-3 w-[64px]">
        {managerView && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(item)}
              className="p-1 rounded hover:bg-[var(--color-paper-3)] text-[var(--color-ink-3)]"
              title="Edit"
            >
              <Icon.Settings size={12} />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1 rounded hover:bg-red-50 text-[var(--color-ink-3)] hover:text-red-500"
              title="Remove"
            >
              <Icon.X size={12} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
  managerView,
  pdfUrl,
  onEdit,
  onDelete,
  onStatusCycle,
}: {
  category: GearCategory;
  items: GearItem[];
  managerView: boolean;
  pdfUrl?: string;
  onEdit: (item: GearItem) => void;
  onDelete: (item: GearItem) => void;
  onStatusCycle: (item: GearItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category];
  const neededCount = items.filter((i) => i.status === 'needed').length;
  const totalCost = items.reduce((sum, i) => sum + (i.estimatedCost ?? 0) * i.quantity, 0);

  return (
    <div className="border border-[var(--color-rule)] rounded-md overflow-hidden mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] transition-colors text-left"
      >
        <span className="text-[14px]">{meta.icon}</span>
        <span className="font-semibold text-[13px] text-[var(--color-ink)] flex-1">{meta.label}</span>
        <span className="text-[11px] text-[var(--color-ink-4)] font-mono">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        {neededCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
            {neededCount} needed
          </span>
        )}
        {totalCost > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-ink-3)]">
            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
        )}
        <Icon.ChevronDown
          size={13}
          className={cn('text-[var(--color-ink-4)] transition-transform', open ? 'rotate-180' : '')}
        />
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-rule-soft)]">
                <th className="py-1.5 pl-3 pr-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[120px]">Status</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide">Item</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-center w-[60px]">Qty</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[90px]">Source</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-right w-[90px]">Est. cost</th>
                <th className="py-1.5 pl-2 pr-3 w-[64px]" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  managerView={managerView}
                  pdfUrl={pdfUrl}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStatusCycle={onStatusCycle}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Money formatting ────────────────────────────────────────────────────────

function fmtMoney(amount: number, currency = 'USD') {
  const code = currency === 'USD' ? '$' : `${currency} `;
  return `${code}${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

// ─── Inline editable cost cell ───────────────────────────────────────────────

interface InlineCostProps {
  value?: number;
  currency?: string;
  onCommit: (next: number | undefined) => void;
  managerView: boolean;
  suffix?: string;       // e.g. "/pax", "/night"
}

function InlineCost({ value, currency = 'USD', onCommit, managerView, suffix }: InlineCostProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '');

  if (!managerView) {
    return value !== undefined ? (
      <span className="font-mono text-[12px]">{fmtMoney(value, currency)}{suffix && <span className="text-[10px] text-[var(--color-ink-4)] ml-0.5">{suffix}</span>}</span>
    ) : (
      <span className="text-[var(--color-ink-4)]">—</span>
    );
  }

  if (editing) {
    const commit = () => {
      const n = draft.trim() === '' ? undefined : Number(draft);
      onCommit(Number.isFinite(n as number) ? (n as number) : undefined);
      setEditing(false);
    };
    return (
      <input
        type="number"
        min="0"
        step="1"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value !== undefined ? String(value) : ''); setEditing(false); }
        }}
        className="w-[80px] px-1.5 py-0.5 rounded border border-[var(--color-ink-3)] bg-[var(--color-paper)] font-mono text-[12px] focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value !== undefined ? String(value) : ''); setEditing(true); }}
      title="Click to edit"
      className="font-mono text-[12px] hover:bg-[var(--color-paper-3)] px-1 -mx-1 rounded"
    >
      {value !== undefined ? (
        <>
          {fmtMoney(value, currency)}
          {suffix && <span className="text-[10px] text-[var(--color-ink-4)] ml-0.5">{suffix}</span>}
        </>
      ) : (
        <span className="text-[var(--color-ink-4)] italic">set price</span>
      )}
    </button>
  );
}

// ─── Travel costs section ────────────────────────────────────────────────────

interface TravelCostsSectionProps {
  travel: Travel[];
  managerView: boolean;
  onCostChange: (id: string, next: number | undefined) => void;
}

function TravelCostsSection({ travel, managerView, onCostChange }: TravelCostsSectionProps) {
  const [open, setOpen] = useState(true);
  const { openPdf } = usePdfViewer();

  // Sort by depart date — derived from dayId (`day_${YYYY-MM-DD}`).
  const sorted = useMemo(() => {
    return [...travel].sort((a, b) => a.dayId.localeCompare(b.dayId));
  }, [travel]);

  const total = sorted.reduce(
    (sum, t) => sum + (t.costPerPassenger ?? 0) * t.passengers.length,
    0,
  );
  const paxTotal = sorted.reduce((sum, t) => sum + t.passengers.length, 0);

  if (sorted.length === 0) return null;

  return (
    <div className="border border-[var(--color-rule)] rounded-md overflow-hidden mb-3">
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] transition-colors text-left cursor-pointer"
      >
        <span className="text-[14px]">✈️</span>
        <span className="font-semibold text-[13px] text-[var(--color-ink)] flex-1">Flights</span>
        <span className="text-[11px] text-[var(--color-ink-4)] font-mono">
          {sorted.length} leg{sorted.length !== 1 ? 's' : ''} · {paxTotal} seat{paxTotal !== 1 ? 's' : ''}
        </span>
        {total > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-ink-3)]">
            {fmtMoney(total)}
          </span>
        )}
        <MockTag source="flight_import" field="Flight costs" />
        <Icon.ChevronDown
          size={13}
          className={cn('text-[var(--color-ink-4)] transition-transform', open ? 'rotate-180' : '')}
        />
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-rule-soft)]">
                <th className="py-1.5 pl-3 pr-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[88px]">Date</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[110px]">Route</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide">Flight</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-center w-[60px]">Pax</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[110px]">Per seat</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-right w-[90px]">Total</th>
                <th className="py-1.5 pl-2 pr-3 w-[80px] text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const date = t.dayId.startsWith('day_') ? t.dayId.slice(4) : '';
                const subtotal = (t.costPerPassenger ?? 0) * t.passengers.length;
                return (
                  <tr key={t.id} className="border-b border-[var(--color-rule-soft)] last:border-0 hover:bg-[var(--color-paper-2)] group">
                    <td className="py-2 pl-3 pr-2 text-[12px] font-mono text-[var(--color-ink-2)]">{date ? fmtDate(date, 'EEE MMM d') : '—'}</td>
                    <td className="py-2 px-2">
                      <span className="font-mono text-[12px] font-semibold">{t.from}</span>
                      <span className="text-[var(--color-ink-4)] mx-1">›</span>
                      <span className="font-mono text-[12px] font-semibold">{t.to}</span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-[13px] font-medium text-[var(--color-ink)]">{t.identifier ?? t.carrier ?? 'Flight'}</div>
                      {t.carrier && t.identifier && (
                        <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5">{t.carrier}{t.recordLocator && ` · ${t.recordLocator}`}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className="font-mono text-[12px]">{t.passengers.length}</span>
                    </td>
                    <td className="py-2 px-2">
                      <InlineCost
                        value={t.costPerPassenger}
                        currency={t.currency}
                        managerView={managerView}
                        onCommit={(v) => onCostChange(t.id, v)}
                        suffix="/seat"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-mono text-[12px] font-semibold">
                        {subtotal > 0 ? fmtMoney(subtotal, t.currency) : <span className="text-[var(--color-ink-4)] font-normal">—</span>}
                      </span>
                    </td>
                    <td className="py-2 pl-2 pr-3 text-right">
                      {t.sourceFilename ? (
                        <button
                          onClick={() => openPdf({ url: '/' + t.sourceFilename, title: t.sourceFilename })}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:underline"
                          title={`Open ${t.sourceFilename}`}
                        >
                          <Icon.Document size={11} />
                          <span>PDF</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[var(--color-ink-4)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Hotel costs section ─────────────────────────────────────────────────────

interface HotelCostsSectionProps {
  hotels: Hotel[];
  managerView: boolean;
  onRateChange: (id: string, next: number | undefined) => void;
}

function HotelCostsSection({ hotels, managerView, onRateChange }: HotelCostsSectionProps) {
  const [open, setOpen] = useState(true);
  const { openPdf } = usePdfViewer();

  const sorted = useMemo(() => {
    return [...hotels].sort((a, b) => a.dayId.localeCompare(b.dayId));
  }, [hotels]);

  function subtotalFor(h: Hotel) {
    const rooms = h.occupants.length;
    const nights = h.nights ?? 1;
    const rate = h.nightlyRate ?? 0;
    const sub = rooms * nights * rate;
    const tax = sub * (h.taxRate ?? 0);
    return { sub, tax, total: sub + tax, rooms, nights };
  }

  const grand = sorted.reduce((sum, h) => sum + subtotalFor(h).total, 0);
  const roomNights = sorted.reduce((sum, h) => sum + subtotalFor(h).rooms * subtotalFor(h).nights, 0);

  if (sorted.length === 0) return null;

  return (
    <div className="border border-[var(--color-rule)] rounded-md overflow-hidden mb-3">
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] transition-colors text-left cursor-pointer"
      >
        <span className="text-[14px]">🏨</span>
        <span className="font-semibold text-[13px] text-[var(--color-ink)] flex-1">Hotels</span>
        <span className="text-[11px] text-[var(--color-ink-4)] font-mono">
          {sorted.length} hotel{sorted.length !== 1 ? 's' : ''} · {roomNights} room-night{roomNights !== 1 ? 's' : ''}
        </span>
        {grand > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-ink-3)]">
            {fmtMoney(grand)}
          </span>
        )}
        <MockTag source="hotel" field="Hotel costs" />
        <Icon.ChevronDown
          size={13}
          className={cn('text-[var(--color-ink-4)] transition-transform', open ? 'rotate-180' : '')}
        />
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-rule-soft)]">
                <th className="py-1.5 pl-3 pr-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[88px]">Check-in</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide">Hotel</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-center w-[60px]">Nights</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-center w-[60px]">Rooms</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide w-[120px]">Per room/night</th>
                <th className="py-1.5 px-2 text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-right w-[110px]">Total + tax</th>
                <th className="py-1.5 pl-2 pr-3 w-[80px] text-[10px] font-semibold text-[var(--color-ink-4)] uppercase tracking-wide text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => {
                const date = h.dayId.startsWith('day_') ? h.dayId.slice(4) : '';
                const { sub, tax, total, rooms, nights } = subtotalFor(h);
                return (
                  <tr key={h.id} className="border-b border-[var(--color-rule-soft)] last:border-0 hover:bg-[var(--color-paper-2)] group">
                    <td className="py-2 pl-3 pr-2 text-[12px] font-mono text-[var(--color-ink-2)]">{date ? fmtDate(date, 'EEE MMM d') : '—'}</td>
                    <td className="py-2 px-2">
                      <div className="text-[13px] font-medium text-[var(--color-ink)]">{h.name}</div>
                      <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5 leading-snug">{h.address}</div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[12px]">{nights}</td>
                    <td className="py-2 px-2 text-center font-mono text-[12px]">{rooms}</td>
                    <td className="py-2 px-2">
                      <InlineCost
                        value={h.nightlyRate}
                        currency={h.currency}
                        managerView={managerView}
                        onCommit={(v) => onRateChange(h.id, v)}
                        suffix="/night"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      {total > 0 ? (
                        <>
                          <div className="font-mono text-[12px] font-semibold">{fmtMoney(total, h.currency)}</div>
                          {tax > 0 && (
                            <div className="text-[10px] text-[var(--color-ink-4)] font-mono">
                              {fmtMoney(sub, h.currency)} + {fmtMoney(tax, h.currency)} tax
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--color-ink-4)]">—</span>
                      )}
                    </td>
                    <td className="py-2 pl-2 pr-3 text-right">
                      {h.sourceFilename ? (
                        <button
                          onClick={() => openPdf({ url: '/' + h.sourceFilename, title: h.sourceFilename })}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:underline"
                          title={`Open ${h.sourceFilename}`}
                        >
                          <Icon.Document size={11} />
                          <span>PDF</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[var(--color-ink-4)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Gear() {
  const { gearItems, updateGearItem, addGearItem, deleteGearItem, updateHotelCost, updateTravelCost, tour, user } = useApp();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<GearCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState<GearItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<GearItem | null>(null);

  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const pdfUrl = tour.riderImports[0]?.pdfObjectUrl;
  const hasRider = tour.riderImports.length > 0;
  const hasTravel = tour.travel.length > 0;
  const hasHotels = tour.hotels.length > 0;
  const hasAnything = hasRider || hasTravel || hasHotels;

  // Summary stats — supplies (rider gear)
  const totalItems = gearItems.length;
  const neededCount = gearItems.filter((i) => i.status === 'needed').length;
  const sourcedCount = gearItems.filter((i) => i.status === 'sourced' || i.status === 'confirmed').length;
  const totalEstCost = gearItems
    .filter((i) => i.status !== 'not_required')
    .reduce((sum, i) => sum + (i.estimatedCost ?? 0) * i.quantity, 0);

  // Summary stats — travel + hotels
  const totalTravelCost = tour.travel.reduce(
    (sum, t) => sum + (t.costPerPassenger ?? 0) * t.passengers.length,
    0,
  );
  const totalHotelCost = tour.hotels.reduce((sum, h) => {
    const rooms = h.occupants.length;
    const nights = h.nights ?? 1;
    const rate = h.nightlyRate ?? 0;
    const sub = rooms * nights * rate;
    const tax = sub * (h.taxRate ?? 0);
    return sum + sub + tax;
  }, 0);
  const grandTotal = totalEstCost + totalTravelCost + totalHotelCost;

  // Filtered + grouped items
  const filtered = useMemo(() => {
    let items = gearItems;
    if (statusFilter !== 'all') items = items.filter((i) => i.status === statusFilter);
    if (categoryFilter !== 'all') items = items.filter((i) => i.category === categoryFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.notes ?? '').toLowerCase().includes(q),
      );
    }
    return items;
  }, [gearItems, statusFilter, categoryFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<GearCategory, GearItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    // Return in canonical category order
    return CATEGORY_ORDER.flatMap((cat) => {
      const items = map.get(cat);
      return items ? [{ category: cat, items }] : [];
    });
  }, [filtered]);

  // Category sidebar counts (unfiltered)
  const categoryCounts = useMemo(() => {
    const map = new Map<GearCategory, number>();
    for (const item of gearItems) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    }
    return map;
  }, [gearItems]);

  function handleStatusCycle(item: GearItem) {
    const idx = STATUS_CYCLE.indexOf(item.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    updateGearItem(item.id, { status: next });
  }

  function handleSaveNew(patch: Omit<GearItem, 'id'>) {
    addGearItem(patch);
  }

  function handleSaveEdit(patch: Omit<GearItem, 'id'>) {
    if (editItem) updateGearItem(editItem.id, patch);
  }

  if (!hasAnything) {
    return (
      <div>
        <PageHeader
          eyebrow="Supplies & Costs"
          title="Supplies & Costs"
          description="Every rider item, flight, and hotel in one place — status, estimated costs, and links back to the source documents."
        />
        <EmptyState
          title="Nothing imported yet"
          hint="Import the rider, the route + flights, and hotels to see supplies and cost rollups here."
          action={
            <div className="flex gap-2">
              <Link to="/ingest/riders"><Button variant="outline">Import rider</Button></Link>
              <Link to="/ingest/flights"><Button variant="outline">Import route &amp; travel</Button></Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Supplies & Costs"
        title="Supplies & Costs"
        description="Rider supplies plus flight and hotel costs. Click any cost cell to edit it; click a status badge to cycle it."
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-ink-3)]">
            {hasRider && <span>{totalItems} supplies</span>}
            {hasTravel && <><span>·</span><span>{tour.travel.length} flight{tour.travel.length !== 1 ? 's' : ''}</span></>}
            {hasHotels && <><span>·</span><span>{tour.hotels.length} hotel{tour.hotels.length !== 1 ? 's' : ''}</span></>}
            {neededCount > 0 && <><span>·</span><span className="text-amber-600 font-semibold">{neededCount} still needed</span></>}
            {grandTotal > 0 && (
              <>
                <span>·</span>
                <span>Grand total: <strong className="text-[var(--color-ink)]">{fmtMoney(grandTotal)}</strong></span>
              </>
            )}
            <MockTag source="gear_costs" field="Estimated costs" />
          </div>
        }
        actions={
          managerView && hasRider && (
            <Button variant="primary" onClick={() => setAddModal(true)}>
              <Icon.Plus size={14} />
              Add item
            </Button>
          )
        }
      />

      <div className="flex gap-0 min-h-0">
        {/* ── Category sidebar ─────────────────────────────────── */}
        <aside className="hidden lg:flex w-[200px] shrink-0 flex-col border-r border-[var(--color-rule)] pr-0 pt-4 pb-8">
          <div className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase text-[var(--color-ink-4)]">
            Category
          </div>
          <ul className="space-y-0.5 px-2">
            <li>
              <button
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded text-[12px] font-semibold transition-colors',
                  categoryFilter === 'all'
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]',
                )}
              >
                <span>All categories</span>
                <span className="font-mono text-[10px] opacity-70">{totalItems}</span>
              </button>
            </li>
            {CATEGORY_ORDER.filter((c) => categoryCounts.has(c)).map((cat) => {
              const cnt = categoryCounts.get(cat) ?? 0;
              const m = CATEGORY_META[cat];
              return (
                <li key={cat}>
                  <button
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors',
                      categoryFilter === cat
                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-semibold'
                        : 'text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]',
                    )}
                  >
                    <span className="text-[12px]">{m.icon}</span>
                    <span className="flex-1 text-left">{m.label}</span>
                    <span className="font-mono text-[10px] opacity-70">{cnt}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ── Main content ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 px-4 pt-4 pb-8">

          {/* ── Travel + Hotel cost sections — render above supplies ── */}
          {(hasTravel || hasHotels) && (
            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-[12px] font-semibold tracking-[0.18em] uppercase text-[var(--color-ink-3)]">
                  Travel &amp; lodging
                </h3>
                <span className="text-[11px] font-mono text-[var(--color-ink-4)]">
                  {(totalTravelCost + totalHotelCost) > 0
                    ? `${fmtMoney(totalTravelCost + totalHotelCost)} combined`
                    : 'Set per-seat and per-room costs to roll up totals'}
                </span>
              </div>
              {hasTravel && (
                <TravelCostsSection
                  travel={tour.travel}
                  managerView={managerView}
                  onCostChange={(id, v) => updateTravelCost(id, { costPerPassenger: v })}
                />
              )}
              {hasHotels && (
                <HotelCostsSection
                  hotels={tour.hotels}
                  managerView={managerView}
                  onRateChange={(id, v) => updateHotelCost(id, { nightlyRate: v })}
                />
              )}
            </div>
          )}

          {/* ── Supplies (rider gear) — only when a rider has been imported ── */}
          {hasRider && (
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-[12px] font-semibold tracking-[0.18em] uppercase text-[var(--color-ink-3)]">
                Rider supplies
              </h3>
              {totalEstCost > 0 && (
                <span className="text-[11px] font-mono text-[var(--color-ink-4)]">
                  {fmtMoney(totalEstCost)} total
                </span>
              )}
            </div>
          )}

          {/* Status summary chips */}
          {hasRider && (<>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(['all', ...STATUS_CYCLE] as StatusFilter[]).map((s) => {
              const count = s === 'all' ? totalItems : gearItems.filter((i) => i.status === s).length;
              if (count === 0 && s !== 'all') return null;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors',
                    statusFilter === s
                      ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                      : 'border-[var(--color-rule)] text-[var(--color-ink-2)] hover:bg-[var(--color-paper-2)]',
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_META[s].label}
                  <span className="ml-1.5 font-mono opacity-70">{count}</span>
                </button>
              );
            })}

            {/* Search */}
            <div className="ml-auto relative">
              <Icon.Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-4)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items…"
                className="pl-7 pr-3 py-1 rounded-full border border-[var(--color-rule)] text-[12px] bg-[var(--color-paper)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink-3)] w-[180px]"
              />
            </div>
          </div>

          {/* Mobile category select */}
          <div className="flex lg:hidden mb-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as GearCategory | 'all')}
              className="px-2.5 py-1.5 rounded border border-[var(--color-rule)] text-[12px] bg-[var(--color-paper)] focus:outline-none"
            >
              <option value="all">All categories ({totalItems})</option>
              {CATEGORY_ORDER.filter((c) => categoryCounts.has(c)).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].label} ({categoryCounts.get(cat) ?? 0})
                </option>
              ))}
            </select>
          </div>

          {/* Summary bar */}
          {totalEstCost > 0 && (
            <div className="mb-4 px-3 py-2.5 rounded-md bg-[var(--color-paper-2)] border border-[var(--color-rule-soft)] flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
              <div>
                <span className="text-[var(--color-ink-3)]">Items: </span>
                <strong>{totalItems}</strong>
              </div>
              <div>
                <span className="text-[var(--color-ink-3)]">Needed: </span>
                <strong className={neededCount > 0 ? 'text-amber-600' : ''}>{neededCount}</strong>
              </div>
              <div>
                <span className="text-[var(--color-ink-3)]">Sourced / confirmed: </span>
                <strong className="text-green-700">{sourcedCount}</strong>
              </div>
              <div className="ml-auto font-mono">
                <span className="text-[var(--color-ink-3)]">Est. total: </span>
                <strong>${totalEstCost.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong>
              </div>
            </div>
          )}

          {/* Item groups */}
          {grouped.length === 0 ? (
            <EmptyState
              title="No items match"
              hint={query ? 'Try a different search term.' : 'Try a different filter.'}
            />
          ) : (
            grouped.map(({ category, items }) => (
              <CategoryGroup
                key={category}
                category={category}
                items={items}
                managerView={managerView}
                pdfUrl={pdfUrl}
                onEdit={setEditItem}
                onDelete={setDeleteItem}
                onStatusCycle={handleStatusCycle}
              />
            ))
          )}

          {/* Quick-add at bottom — manager only */}
          {managerView && (
            <button
              onClick={() => setAddModal(true)}
              className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] transition-colors"
            >
              <Icon.Plus size={12} />
              Add item not in rider
            </button>
          )}
          </>
          )}
        </div>
      </div>

      {/* Modals — manager only */}
      {managerView && addModal && (
        <ItemModal onSave={handleSaveNew} onClose={() => setAddModal(false)} />
      )}
      {managerView && editItem && (
        <ItemModal item={editItem} onSave={handleSaveEdit} onClose={() => setEditItem(null)} />
      )}
      {managerView && deleteItem && (
        <DeleteModal item={deleteItem} onConfirm={() => deleteGearItem(deleteItem.id)} onClose={() => setDeleteItem(null)} />
      )}
    </div>
  );
}
