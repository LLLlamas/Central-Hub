import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/state/AppState';
import type { PendingEdit } from '@/state/AppState';
import { MOCK_NOW } from '@/lib/today';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockBadge } from '@/components/provenance/MockBadge';
import { SourceTag } from '@/components/provenance/SourceTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { RiderRef, linkifyRiderRefs } from '@/components/RiderRef';
import { ConflictResolveModal } from '@/components/ConflictResolveModal';
import { ExplainTag, ConflictExplain, ExcludedBrandExplain } from '@/components/ExplainTag';
import { LastUpdated } from '@/components/LastUpdated';
import { usePdfViewer } from '@/components/PdfViewer';
import { FileDropZone } from '@/components/ingest/FileDropZone';
import { UploadResultNote } from '@/components/ingest/UploadResultNote';
import type { UploadNote } from '@/components/ingest/UploadResultNote';
import { RIDER_PDF_PATH } from '@/lib/riderSections';
import { matchFixture, fixturesOfKind, nonMatchNote } from '@/lib/fixtureMatcher';
import { buildScratchRiderImport, buildScratchRiderPersonnel } from '@/data/riderFixture';
import { parseRiderPdf } from '@/lib/pdfParser';
import { cn } from '@/lib/cn';
import type {
  RiderImport,
  RiderSection,
  RiderSectionType,
  RiderSectionStatus,
  Conflict,
  InputChannel,
  MonitorMix,
  FOHOutput,
  SectionEditRecord,
  UpdateStamp,
} from '@/types';

// Friendly labels for the canonical section types (handoff §1).
const SECTION_LABELS: Record<RiderSectionType, string> = {
  cover_and_contacts: 'Cover & Contacts',
  production_control: 'Production Control',
  permits: 'Permits',
  stage_specs: 'Stage Specs',
  audio_pa: 'Audio — PA',
  audio_monitors: 'Audio — Monitors',
  input_list: 'Input List',
  output_patch: 'FOH Output Patch',
  stage_plot: 'Stage Plot',
  lighting_equipment: 'Lighting — Equipment',
  lighting_plot: 'Lighting — Plot (CAD)',
  backline: 'Backline',
  video: 'Video',
  soundcheck: 'Soundcheck',
  ground_transport: 'Ground Transport',
  air_transport: 'Air Transport',
  lodging: 'Lodging',
  dressing_rooms: 'Dressing Rooms',
  catering: 'Catering',
  settlement: 'Settlement',
  other: 'Conflicts & Notes',
};

export function RiderIngest() {
  const { tour, isSectionApproved, getPendingEdit } = useApp();
  const { openPdf } = usePdfViewer();
  const imp = tour.riderImports[0];
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    if (!imp) return null;
    const inputListIdx = imp.sections.findIndex((s) => s.type === 'input_list');
    if (inputListIdx >= 0) return `input_list-${inputListIdx}`;
    return imp.sections[0] ? `${imp.sections[0].type}-0` : null;
  });
  const [sectionFilter, setSectionFilter] = useState<'all' | 'needs-review' | 'conflicts'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs-review' | 'approved' | 'pending'>('all');
  const [confSort, setConfSort] = useState<'desc' | 'asc'>('desc');

  if (!imp) {
    return (
      <div>
        <PageHeader
          eyebrow="Import rider"
          title="Rider import"
          description="Drop a rider PDF and the AI ingest extracts every section for review."
        />
        <ScratchRiderUpload />
      </div>
    );
  }

  // Sections are keyed by `type-index` so we can disambiguate
  // multiple sections with the same type if there ever are.
  const sectionMap = new Map<string, RiderSection>();
  imp.sections.forEach((s, i) => sectionMap.set(`${s.type}-${i}`, s));
  const section = activeSection ? sectionMap.get(activeSection) ?? null : null;
  const approvedCount = imp.sections.filter((s, i) => isSectionApproved(`${s.type}-${i}`)).length;

  // Pipeline step (sectionFilter) and status chips (statusFilter) are two
  // dimensions; only one is active at a time — selecting one resets the other.
  const selectPipelineFilter = (f: 'all' | 'needs-review' | 'conflicts') => {
    setSectionFilter(f);
    setStatusFilter('all');
  };
  const selectStatusFilter = (f: 'all' | 'needs-review' | 'approved' | 'pending') => {
    setStatusFilter(f);
    setSectionFilter('all');
  };

  const filteredSections = imp.sections
    .map((s, i) => ({ s, i, key: `${s.type}-${i}` }))
    .filter(({ s, key }) => {
      if (sectionFilter === 'needs-review' && isSectionApproved(key)) return false;
      if (sectionFilter === 'conflicts' && (s.conflicts?.length ?? 0) === 0) return false;
      if (statusFilter === 'needs-review' && (isSectionApproved(key) || !!getPendingEdit(key))) return false;
      if (statusFilter === 'approved' && !isSectionApproved(key)) return false;
      if (statusFilter === 'pending' && !getPendingEdit(key)) return false;
      return true;
    });
  const sortedFilteredSections = [...filteredSections].sort((a, b) => {
    const ca = a.s.confidence ?? 0;
    const cb = b.s.confidence ?? 0;
    return confSort === 'desc' ? cb - ca : ca - cb;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Import rider"
        title={
          <>
            Rider import
          </>
        }
        description="Review each extracted section, correct anything the AI got wrong inline, then approve it. Conflicts surface for a human decision and are never auto-resolved."
        actions={
          <Button variant="primary" leading={<Icon.Plus size={14} />}>
            Upload rider
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openPdf({ url: RIDER_PDF_PATH, title: imp.filename })}
              title="View the rider PDF"
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Chip tone="critical">
                <Icon.Document size={10} /> {imp.filename}
              </Chip>
            </button>
            <Chip tone="neutral" variant="outline">
              <Icon.Document size={10} /> {imp.pageCount} pages
            </Chip>
            <Chip tone="travel" variant="outline">
              Source: {imp.sourceLanguage.toUpperCase()}
            </Chip>
            <Chip tone="rehearsal">Revision {imp.revision}</Chip>
            <MockBadge source="rider_import" className="ml-2" />
          </div>
        }
      />

      {/* Cover & revision banner */}
      <CoverBanner imp={imp} />

      <PipelineStrip
        sections={imp.sections}
        approvedCount={approvedCount}
        activeFilter={sectionFilter}
        onFilter={selectPipelineFilter}
      />

      <div className="grid lg:grid-cols-[260px_1fr] gap-5 mt-6">
        {/* Sections list */}
        <Card padded={false} className="overflow-hidden">
          <div data-tour="rider-sections" className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
            <div className="eyebrow">Detected sections</div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {imp.sections.length} found · {approvedCount} approved
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {(['all', 'needs-review', 'approved', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => selectStatusFilter(f)}
                  className={cn(
                    'h-6 px-2 text-[10.5px] font-mono uppercase tracking-[0.08em] rounded-[2px] border transition-colors',
                    statusFilter === f
                      ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                      : 'border-[var(--color-rule)] text-[var(--color-ink-3)] hover:border-[var(--color-ink-4)]',
                  )}
                >
                  {f === 'all' ? 'All' : f === 'needs-review' ? 'Needs review' : f === 'approved' ? 'Approved' : 'Pending'}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <button
                onClick={() => setConfSort((cs) => (cs === 'desc' ? 'asc' : 'desc'))}
                className="inline-flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.08em] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
              >
                Conf {confSort === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-rule-soft)] max-h-[600px] overflow-y-auto">
            {sortedFilteredSections.map(({ s, i, key }) => {
              const active = key === activeSection;
              const hasConflicts = (s.conflicts?.length ?? 0) > 0;
              const hasPending = !!getPendingEdit(key);
              return (
                <li key={key}>
                  <button
                    onClick={() => setActiveSection(key)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 hover:bg-[var(--color-paper)]/60 transition-colors',
                      active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold">{SECTION_LABELS[s.type]}</span>
                      <div className="flex items-center gap-1.5">
                        {hasPending && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--color-accent)' }}
                            title="Proposed edit pending approval"
                          />
                        )}
                        {hasConflicts && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--color-accent)' }}
                            title="Conflicts detected"
                          />
                        )}
                        <SectionStatusDot status={isSectionApproved(key) ? 'approved' : s.status} />
                      </div>
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-2 mt-1 text-[10.5px] font-mono tabular',
                        active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-4)]',
                      )}
                    >
                      <span>{s.pages.length > 0 ? `pp. ${s.pages.join(', ')}` : 'derived'}</span>
                      {s.confidence != null && <span>· conf {(s.confidence * 100).toFixed(0)}%</span>}
                      {s.type === 'input_list' && s.inputList?.length && (
                        <span>· {s.inputList.length} ch{s.monitorMix?.length ? ` · ${s.monitorMix.length} mx` : ''}{s.fohOutputs?.length ? ` · ${s.fohOutputs.length} foh` : ''}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
            {sortedFilteredSections.length === 0 && (
              <li className="px-4 py-6 text-[11.5px] text-[var(--color-ink-3)] text-center">
                No sections match this filter.
              </li>
            )}
          </ul>
        </Card>

        {/* Section detail. min-w-0 lets long content (JSON, free text, wide
            tables) live inside the 1fr column without pushing the grid
            past the page max-width. Without it, CSS Grid auto-min-width
            lets children stretch the column. */}
        <div className="space-y-5 min-w-0">{section && activeSection ? <SectionView section={section} sectionKey={activeSection} sourceLang={imp.sourceLanguage} /> : null}</div>
      </div>

      <DataSourcesPanel
        sourceKeys={[
          'rider_import',
          'rider_cover_contacts',
          'rider_input_list',
          'rider_monitor_mix',
          'rider_foh_outputs',
          'rider_backline',
          'rider_lodging',
          'rider_catering',
          'rider_conflicts',
        ]}
        intro="Every section on this page is REAL data extracted from the Elsa y Elmar rider PDF. The pipeline behavior — section classification, per-section extraction, conflict detection — is documented in handoff-post-pdf-interpret.md and implemented per the schemas there."
      />
    </div>
  );
}

function CoverBanner({ imp }: { imp: RiderImport }) {
  const inputSec = imp.sections.find(s => s.type === 'input_list');
  const bandMembers = (inputSec?.monitorMix ?? []).map(m => m.personName).filter(Boolean) as string[];
  return (
    <Card className="mb-5 border-l-4" padded={false}>
      <div
        className="border-l-4 px-5 py-4 grid sm:grid-cols-[1fr_auto] gap-4 items-start"
        style={{ borderLeftColor: 'var(--color-accent)' }}
      >
        <div>
          <div className="eyebrow text-[var(--color-accent)] mb-1">Rider revision · {imp.revisionInfo?.date}</div>
          <div className="font-display text-[20px] leading-tight font-bold inline-flex items-baseline gap-1.5">
            {imp.artistName}
            <SourceTag source="rider_artist" field="Artist" />
          </div>
          {imp.revisionInfo?.warning && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-mono uppercase tracking-[0.10em] text-[var(--color-accent)]">
              <Icon.Alert size={11} /> {imp.revisionInfo.warning}
              <ExplainTag
                title="Why this version warning matters"
                ariaLabel="Explain the rider version warning"
                riderLink={{ section: 1, label: 'Open the rider cover page' }}
              >
                This rider tells you to ignore older copies of itself. Touring
                documents are revised often, and working from an outdated rider
                causes real problems on show day — wrong gear ordered, missed
                requirements, contradictions with the artist's team. Always work
                from the newest version.
              </ExplainTag>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px]">
          {imp.productionManager?.name && (
            <ContactBlock
              label="Production Manager"
              value={imp.productionManager.name}
              sub={imp.productionManager.email ?? imp.productionManager.phone}
              sourceKey="rider_pm_contact"
            />
          )}
          {inputSec?.inputList?.length ? (
            <Fact
              label="Input list"
              value={`${inputSec.inputList.length} ch`}
              sub={[inputSec.monitorMix?.length && `${inputSec.monitorMix.length} mx`, inputSec.fohOutputs?.length && `${inputSec.fohOutputs.length} foh`].filter(Boolean).join(' · ') || undefined}
              sourceKey="rider_input_list"
            />
          ) : null}
          {bandMembers.length > 0 && (
            <Fact label="Band (from mixes)" value={bandMembers.join(', ')} sourceKey="rider_input_list" />
          )}
          {imp.partySize && (
            <>
              <Fact label="Party size" value={String(imp.partySize.tourists ?? '—')} sourceKey="rider_party_size" />
              <Fact label="Hotel rooms" value={String(imp.partySize.rooms ?? '—')} sourceKey="rider_rooms" />
              <Fact label="Flight tickets" value={String(imp.partySize.flightTickets ?? '—')} sourceKey="rider_flight_tickets" />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ContactBlock({
  label,
  value,
  sub,
  sourceKey,
}: {
  label: string;
  value: string;
  sub?: string;
  sourceKey?: import('@/data/realSources').RealSourceKey;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="text-[13px] font-semibold mt-1 leading-tight inline-flex items-baseline gap-1">
        {value}
        {sourceKey && <SourceTag source={sourceKey} field={label} />}
      </div>
      {sub && <div className="font-mono text-[10.5px] text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}

function Fact({
  label,
  value,
  sub,
  sourceKey,
}: {
  label: string;
  value: string;
  sub?: string;
  sourceKey?: import('@/data/realSources').RealSourceKey;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-mono text-[14px] tabular font-bold text-[var(--color-ink)] mt-1 inline-flex items-baseline gap-1">
        {value}
        {sourceKey && <SourceTag source={sourceKey} field={label} />}
      </div>
      {sub && <div className="font-mono text-[10.5px] text-[var(--color-ink-3)] mt-0.5">{sub}</div>}
    </div>
  );
}

function PipelineStrip({
  sections,
  approvedCount,
  activeFilter,
  onFilter,
}: {
  sections: RiderSection[];
  approvedCount: number;
  activeFilter: 'all' | 'needs-review' | 'conflicts';
  onFilter: (f: 'all' | 'needs-review' | 'conflicts') => void;
}) {
  const total = sections.length;
  const processed = sections.filter((s) => s.status !== 'pending').length;
  const avgConf = sections.reduce((a, s) => a + (s.confidence ?? 0), 0) / Math.max(1, sections.length);
  const conflictCount = sections.reduce((a, s) => a + (s.conflicts?.length ?? 0), 0);

  return (
    <Card padded={false}>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--color-rule-soft)]">
        <PipelineStep num="01" label="Classify" value={`${total} sections detected`} hint="Single API call. Returns sections present, page ranges, language, PM contact." status="done" filterTarget="all" activeFilter={activeFilter} onFilter={onFilter} />
        <PipelineStep num="02" label="Extract" value={`${processed}/${total} extracted`} hint="One structured-output call per section. Schemas per type." status={processed < total ? 'doing' : 'done'} filterTarget="all" activeFilter={activeFilter} onFilter={onFilter} />
        <PipelineStep num="03" label="Review" value={`${approvedCount}/${total} approved`} hint="Correct any wrong field inline, then approve the section." status={approvedCount < total ? 'doing' : 'done'} filterTarget="needs-review" activeFilter={activeFilter} onFilter={onFilter} />
        <PipelineStep num="04" label="Conflicts" value={`${conflictCount} flagged · avg conf ${(avgConf * 100).toFixed(0)}%`} hint="Never auto-resolved. Human always decides." status={conflictCount > 0 ? 'doing' : 'done'} filterTarget="conflicts" activeFilter={activeFilter} onFilter={onFilter} />
      </div>
    </Card>
  );
}

function PipelineStep({
  num,
  label,
  value,
  hint,
  status,
  filterTarget,
  activeFilter,
  onFilter,
}: {
  num: string;
  label: string;
  value: string;
  hint: string;
  status: 'done' | 'doing' | 'pending';
  filterTarget: 'all' | 'needs-review' | 'conflicts';
  activeFilter: 'all' | 'needs-review' | 'conflicts';
  onFilter: (f: 'all' | 'needs-review' | 'conflicts') => void;
}) {
  const isActive = activeFilter === filterTarget && filterTarget !== 'all';
  return (
    <button
      type="button"
      onClick={() => onFilter(filterTarget === activeFilter ? 'all' : filterTarget)}
      className={cn(
        'px-4 py-4 text-left w-full transition-colors',
        isActive
          ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
          : 'hover:bg-[var(--color-paper-2)]/60',
      )}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="font-mono text-[11px] font-bold tracking-[0.10em]"
          style={{
            color: isActive
              ? 'var(--color-paper)'
              : status === 'done' ? 'var(--color-day-promo)'
              : status === 'doing' ? 'var(--color-day-rehearsal)'
              : 'var(--color-ink-4)',
          }}
        >
          {num}
        </span>
        <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-[0.10em]', isActive ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-3)]')}>
          {label}
        </span>
        {!isActive && status === 'doing' && <Chip tone="rehearsal" size="sm">Active</Chip>}
        {!isActive && status === 'done' && <Chip tone="success" size="sm">Done</Chip>}
        {isActive && <span className="font-mono text-[10px] text-[var(--color-paper)] opacity-60 ml-auto">filtered ×</span>}
      </div>
      <div className={cn('text-[15px] font-semibold', isActive ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]')}>{value}</div>
      <div className={cn('text-[11.5px] mt-0.5 leading-relaxed', isActive ? 'text-[var(--color-paper)] opacity-70' : 'text-[var(--color-ink-3)]')}>{hint}</div>
    </button>
  );
}

function SectionStatusDot({ status }: { status: RiderSectionStatus }) {
  const color = {
    pending: 'var(--color-ink-4)',
    extracted: 'var(--color-day-travel)',
    review: 'var(--color-day-rehearsal)',
    approved: 'var(--color-day-promo)',
  }[status];
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />;
}

function SectionStatusChip({ status }: { status: RiderSectionStatus }) {
  const map = {
    pending: { tone: 'off', label: 'Pending' },
    extracted: { tone: 'travel', label: 'Extracted' },
    review: { tone: 'rehearsal', label: 'Review' },
    approved: { tone: 'success', label: 'Approved' },
  } as const;
  const m = map[status];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

function PendingEditBanner({
  pending,
  managerView,
  onApprove,
  onReject,
}: {
  pending: PendingEdit;
  managerView: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-[3px] border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/6 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Icon.Alert size={12} className="text-[var(--color-accent)] shrink-0" />
        <LastUpdated label="Proposed" stamp={pending.proposedAt} />
      </div>
      {managerView ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReject}>Reject</Button>
          <Button size="sm" variant="primary" leading={<Icon.Check size={12} />} onClick={onApprove}>
            Approve edit
          </Button>
        </div>
      ) : (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
          Awaiting approval
        </span>
      )}
    </div>
  );
}

function SectionView({
  section,
  sectionKey,
  sourceLang,
}: {
  section: RiderSection;
  sectionKey: string;
  sourceLang: string;
}) {
  const {
    user,
    getSectionEdit,
    updateSectionEdit,
    isSectionApproved,
    getSectionApproval,
    approveSection,
    reopenSection,
    getPendingEdit,
    proposeSectionEdit,
    approvePendingEdit,
    rejectPendingEdit,
    getSectionHistory,
  } = useApp();

  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const edit = getSectionEdit(sectionKey);
  const pending = getPendingEdit(sectionKey);
  const approved = isSectionApproved(sectionKey);
  const approval = getSectionApproval(sectionKey);

  // Effective payload: pending proposal (if any) over approved edits over AI extraction.
  const inputList = pending?.patch.inputList ?? edit?.inputList ?? section.inputList;
  const monitorMix = pending?.patch.monitorMix ?? edit?.monitorMix ?? section.monitorMix;
  const fohOutputs = pending?.patch.fohOutputs ?? edit?.fohOutputs ?? section.fohOutputs;
  const freeText = pending?.patch.freeText ?? edit?.freeText ?? section.freeText;
  const freeTextEn = pending?.patch.freeTextEn ?? edit?.freeTextEn ?? section.freeTextEn;
  const effStatus: RiderSectionStatus = approved ? 'approved' : section.status;
  const eff: RiderSection = { ...section, inputList, monitorMix, fohOutputs, freeText, freeTextEn };

  // Route onChange to direct edit (managers) or proposal (everyone else).
  // Captures the current effective state as `before` for the diff/history.
  const editOrPropose = (patch: Parameters<typeof updateSectionEdit>[1]) => {
    const before = { inputList, monitorMix, fohOutputs, freeText, freeTextEn };
    if (managerView) {
      updateSectionEdit(sectionKey, patch, before);
    } else {
      proposeSectionEdit(sectionKey, patch, before);
    }
  };

  return (
    <>
      <SectionCard
        title={SECTION_LABELS[section.type]}
        eyebrow={`${section.pages.length > 0 ? `pp. ${section.pages.join(', ')} · ` : ''}${section.language?.toUpperCase() ?? sourceLang.toUpperCase()}`}
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {section.confidence != null && (
              <Chip
                tone={section.confidence >= 0.9 ? 'success' : section.confidence >= 0.75 ? 'rehearsal' : 'critical'}
                variant="outline"
                size="sm"
              >
                Conf {(section.confidence * 100).toFixed(0)}%
              </Chip>
            )}
            <SectionStatusChip status={effStatus} />
            {managerView && (
              <Button size="sm" variant="outline" leading={<Icon.X size={12} />}>
                Re-extract
              </Button>
            )}
            {managerView && (approved ? (
              <Button size="sm" variant="outline" onClick={() => reopenSection(sectionKey)}>
                Reopen
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                leading={<Icon.Check size={12} />}
                onClick={() => approveSection(sectionKey)}
              >
                Approve section
              </Button>
            ))}
          </div>
        }
      >
        {pending && (
          <PendingEditBanner
            pending={pending}
            managerView={managerView}
            onApprove={() => approvePendingEdit(sectionKey)}
            onReject={() => rejectPendingEdit(sectionKey)}
          />
        )}
        {!pending && approved && approval ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-[3px] border border-[var(--color-moss)]/35 bg-[var(--color-moss)]/8 px-2.5 py-1.5">
            <Icon.Check size={12} className="text-[var(--color-moss)] shrink-0" />
            <LastUpdated label="Approved" stamp={approval} />
          </div>
        ) : !pending ? (
          <p className="mb-4 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
            {managerView
              ? 'Click any field to correct what the AI extracted. Approve the section once it matches the source.'
              : 'Click any field to propose a correction. Your changes will be reviewed by the production manager before taking effect.'}
          </p>
        ) : null}

        {inputList ? (
          <InputListReview
            channels={inputList}
            disabled={approved}
            history={getSectionHistory(sectionKey)}
            userName={user.name}
            onChange={(v) => editOrPropose({ inputList: v })}
          />
        ) : monitorMix ? (
          <MonitorMixReview
            mixes={monitorMix}
            disabled={approved}
            history={getSectionHistory(sectionKey)}
            userName={user.name}
            onChange={(v) => editOrPropose({ monitorMix: v })}
          />
        ) : fohOutputs ? (
          <FOHOutputsReview
            outputs={fohOutputs}
            disabled={approved}
            history={getSectionHistory(sectionKey)}
            userName={user.name}
            onChange={(v) => editOrPropose({ fohOutputs: v })}
          />
        ) : section.backline ? (
          <BacklineReview backline={section.backline} />
        ) : section.lodging ? (
          <LodgingReview lodging={section.lodging} />
        ) : section.catering ? (
          <CateringReview catering={section.catering} />
        ) : section.conflicts ? (
          <ConflictsReview conflicts={section.conflicts} />
        ) : (
          <FreeTextReview
            es={freeText}
            en={freeTextEn}
            disabled={approved}
            onChangeEs={(v) => editOrPropose({ freeText: v })}
            onChangeEn={(v) => editOrPropose({ freeTextEn: v })}
          />
        )}
      </SectionCard>

      <details className="card overflow-hidden">
        <summary className="cursor-pointer px-5 py-3 text-[12.5px] font-semibold text-[var(--color-ink)]">
          View raw extraction
        </summary>
        <pre className="font-mono text-[11px] leading-[1.5] text-[var(--color-ink-2)] bg-[var(--color-paper-2)]/40 p-4 border-t border-[var(--color-rule-soft)] overflow-x-auto max-h-[280px] w-full max-w-full">
{JSON.stringify(stripUiNoise(eff), null, 2)}
        </pre>
      </details>
    </>
  );
}

function stripUiNoise(s: RiderSection) {
  const out: any = { type: s.type, pages: s.pages, confidence: s.confidence, language: s.language };
  if (s.inputList) out.input_list = s.inputList;
  if (s.monitorMix) out.monitor_mix = s.monitorMix;
  if (s.fohOutputs) out.foh_outputs = s.fohOutputs;
  if (s.backline) out.backline = s.backline;
  if (s.lodging) out.lodging = s.lodging;
  if (s.catering) out.catering = s.catering;
  if (s.conflicts) out.conflicts = s.conflicts;
  if (s.freeText) out.free_text = s.freeText;
  if (s.freeTextEn) out.free_text_en = s.freeTextEn;
  return out;
}

// =========================================================
// Per-section review components
// =========================================================

// --- Inline-edit primitives ------------------------------
// Borderless inputs that read as plain text until hovered/focused, so a
// dense review table stays calm but every value is one click from editable.
// Disabled (= section approved) renders them as static, locked text.

function EditableText({
  value,
  onChange,
  disabled,
  mono = false,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  mono?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full min-w-0 bg-transparent rounded-[2px] px-1 py-0.5 outline-none border border-transparent',
        disabled
          ? 'cursor-default'
          : 'hover:border-[var(--color-rule)] focus:border-[var(--color-ocean)] focus:bg-[var(--color-card)]',
        mono && 'font-mono',
        className,
      )}
    />
  );
}

function EditableSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full min-w-0 bg-transparent rounded-[2px] px-1 py-0.5 text-[11px] uppercase tracking-[0.04em] outline-none border border-transparent',
        disabled
          ? 'cursor-default appearance-none text-[var(--color-ink-3)]'
          : 'hover:border-[var(--color-rule)] focus:border-[var(--color-ocean)] focus:bg-[var(--color-card)] cursor-pointer',
      )}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const STAND_OPTIONS = [
  { value: 'boom', label: 'Boom' },
  { value: 'short_boom', label: 'Short boom' },
  { value: 'tall_boom', label: 'Tall boom' },
  { value: 'mini_boom', label: 'Mini boom' },
  { value: 'straight', label: 'Straight' },
  { value: 'clamp', label: 'Clamp' },
  { value: 'none', label: 'None' },
  { value: 'other', label: 'Other' },
] as const;

const MONITOR_TYPE_OPTIONS = [
  { value: 'in_ear_stereo', label: 'In-ear stereo' },
  { value: 'in_ear_mono', label: 'In-ear mono' },
  { value: 'wedge', label: 'Wedge' },
  { value: 'side_fill', label: 'Side fill' },
  { value: 'drum_fill', label: 'Drum fill' },
  { value: 'other', label: 'Other' },
] as const;

// ---- Section edit history modal -------------------------

function SectionHistoryModal({
  history,
  onClose,
}: {
  history: SectionEditRecord[];
  onClose: () => void;
}) {
  return (
    <Modal open title="Edit history" eyebrow="Section edits" onClose={onClose} size="lg">
      {history.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)]">No recorded edits.</p>
      ) : (
        <ul className="space-y-4">
          {[...history].reverse().map((rec, idx) => (
            <li key={idx} className={cn(
              'rounded-[4px] border px-4 py-3 space-y-2',
              rec.status === 'approved' ? 'border-[var(--color-moss)]/35 bg-[var(--color-moss)]/5'
              : rec.status === 'rejected' ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/5'
              : 'border-[var(--color-rule)]',
            )}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.12em]',
                  rec.status === 'approved' ? 'text-[var(--color-moss)]'
                  : rec.status === 'rejected' ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-ink-4)]',
                )}>
                  {rec.status === 'approved' ? '✓ Approved' : rec.status === 'rejected' ? '✕ Rejected' : '• Direct edit'}
                </span>
                {rec.proposedAt && (
                  <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
                    Proposed by {rec.proposedAt.by} · {new Date(rec.proposedAt.at).toLocaleString()}
                  </span>
                )}
                <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
                  {rec.status === 'direct' ? 'By' : rec.status === 'approved' ? 'Approved by' : 'Rejected by'}{' '}
                  {rec.resolvedAt.by} · {new Date(rec.resolvedAt.at).toLocaleString()}
                </span>
              </div>
              {rec.changes.length > 0 ? (
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="text-left text-[10px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
                      <th className="pb-1 pr-3 w-[35%]">Row</th>
                      <th className="pb-1 pr-3 w-[15%]">Field</th>
                      <th className="pb-1 pr-3">Before</th>
                      <th className="pb-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.changes.map((ch, ci) => (
                      <tr key={ci} className="border-t border-[var(--color-rule-soft)]">
                        <td className="py-1 pr-3 text-[var(--color-ink-3)] truncate max-w-[160px]">{ch.rowLabel}</td>
                        <td className="py-1 pr-3 font-mono text-[10px] text-[var(--color-ink-4)] uppercase">{ch.field}</td>
                        <td className="py-1 pr-3 line-through text-[var(--color-ink-4)] max-w-[140px] truncate">{ch.before || '—'}</td>
                        <td className="py-1 text-[var(--color-ink)] font-semibold max-w-[140px] truncate">{ch.after || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[11.5px] text-[var(--color-ink-3)] italic">No field-level diff recorded.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ---- Last-edited cell chip --------------------------------

function LastEditedCell({
  stamp,
  history,
}: {
  stamp: UpdateStamp | undefined;
  history: SectionEditRecord[];
}) {
  const [showHistory, setShowHistory] = useState(false);
  if (!stamp && history.length === 0) return <span className="text-[var(--color-ink-4)]">—</span>;
  const count = history.length;
  return (
    <>
      <button
        type="button"
        onClick={() => count > 0 && setShowHistory(true)}
        className={cn(
          'inline-flex flex-col items-start text-left gap-0.5',
          count > 0 ? 'cursor-pointer hover:opacity-70' : 'cursor-default',
        )}
      >
        {stamp ? (
          <>
            <span className="font-mono text-[10px] text-[var(--color-ink-3)]">{stamp.by}</span>
            <span className="font-mono text-[9.5px] text-[var(--color-ink-4)]">{new Date(stamp.at).toLocaleString()}</span>
          </>
        ) : (
          <span className="font-mono text-[10px] text-[var(--color-ink-4)]">pending</span>
        )}
        {count > 0 && (
          <span className="font-mono text-[9.5px] text-[var(--color-ocean)] underline underline-offset-2">
            {count} edit{count !== 1 ? 's' : ''} →
          </span>
        )}
      </button>
      {showHistory && (
        <SectionHistoryModal history={history} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
}

// ---- Column filter popup ---------------------------------

function ColumnFilterPopup({
  label,
  active,
  onClear,
  children,
}: {
  label: React.ReactNode;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.14em] rounded-[2px] px-1 py-0.5',
          active
            ? 'text-[var(--color-ocean)] bg-[var(--color-ocean)]/10'
            : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]',
        )}
      >
        {label}
        <Icon.Chevron size={9} className={cn('transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] shadow-md p-2 space-y-1.5">
          {children}
          {active && (
            <button
              type="button"
              onClick={() => { onClear(); setOpen(false); }}
              className="w-full text-left text-[11px] text-[var(--color-accent)] font-semibold pt-1 border-t border-[var(--color-rule-soft)]"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left text-[11.5px] px-1.5 py-1 rounded-[2px]',
        selected ? 'bg-[var(--color-ink)] text-[var(--color-paper)]' : 'hover:bg-[var(--color-paper-2)]',
      )}
    >
      {label}
    </button>
  );
}

// ---- Table review components ----------------------------

function InputListReview({
  channels,
  onChange,
  disabled,
  history,
  userName,
}: {
  channels: InputChannel[];
  onChange: (channels: InputChannel[]) => void;
  disabled: boolean;
  history: SectionEditRecord[];
  userName: string;
}) {
  const [flagFilter, setFlagFilter] = useState<'all' | 'flagged' | 'clean'>('all');
  const [editedFilter, setEditedFilter] = useState<'all' | 'edited' | 'unedited'>('all');

  const update = (i: number, patch: Partial<InputChannel>) => {
    const updated = channels.map((c, idx) => idx === i ? { ...c, ...patch, lastEditedAt: { at: MOCK_NOW, by: userName } } : c);
    onChange(updated);
  };

  const sorted = [...channels].sort((a, b) => {
    const af = (a.extractionFlags?.length ?? 0) > 0 ? 0 : 1;
    const bf = (b.extractionFlags?.length ?? 0) > 0 ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.channelNumber - b.channelNumber;
  });

  const visible = sorted.filter((c) => {
    const hasFlags = (c.extractionFlags?.length ?? 0) > 0;
    const hasEdit = !!c.lastEditedAt;
    if (flagFilter === 'flagged' && !hasFlags) return false;
    if (flagFilter === 'clean' && hasFlags) return false;
    if (editedFilter === 'edited' && !hasEdit) return false;
    if (editedFilter === 'unedited' && hasEdit) return false;
    return true;
  });

  return (
    <div>
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        {channels.length} channels. Mic and DI model numbers are preserved verbatim — never translated. Flagged rows sort to top.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-2.5 py-2 w-10">Ch</th>
              <th className="px-2.5 py-2 min-w-[140px]">Source</th>
              <th className="px-2.5 py-2 min-w-[110px]">Mic / DI</th>
              <th className="px-2.5 py-2 w-28">Stand</th>
              <th className="px-2.5 py-2 w-12 text-center">+48V</th>
              <th className="px-2.5 py-2 w-28">Wireless</th>
              <th className="px-2.5 py-2 w-40">
                <ColumnFilterPopup
                  label="Flags"
                  active={flagFilter !== 'all'}
                  onClear={() => setFlagFilter('all')}
                >
                  <FilterOption label="All" selected={flagFilter === 'all'} onSelect={() => setFlagFilter('all')} />
                  <FilterOption label="Flagged only" selected={flagFilter === 'flagged'} onSelect={() => setFlagFilter('flagged')} />
                  <FilterOption label="Clean only" selected={flagFilter === 'clean'} onSelect={() => setFlagFilter('clean')} />
                </ColumnFilterPopup>
              </th>
              <th className="px-2.5 py-2 w-36">
                <ColumnFilterPopup
                  label="Last edited"
                  active={editedFilter !== 'all'}
                  onClear={() => setEditedFilter('all')}
                >
                  <FilterOption label="All" selected={editedFilter === 'all'} onSelect={() => setEditedFilter('all')} />
                  <FilterOption label="Edited" selected={editedFilter === 'edited'} onSelect={() => setEditedFilter('edited')} />
                  <FilterOption label="Not edited" selected={editedFilter === 'unedited'} onSelect={() => setEditedFilter('unedited')} />
                </ColumnFilterPopup>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const i = channels.indexOf(c);
              const hasFlags = (c.extractionFlags?.length ?? 0) > 0;
              return (
                <tr
                  key={c.channelNumber}
                  className={cn(
                    'border-t border-[var(--color-rule-soft)]',
                    hasFlags && 'bg-[rgba(184,57,43,0.04)]',
                  )}
                >
                  <td className="px-2.5 py-1.5 font-mono tabular font-semibold text-[var(--color-ink-2)] align-top">{c.channelNumber}</td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableText value={c.source} disabled={disabled} onChange={(v) => update(i, { source: v })} />
                    <EditableText
                      value={c.sourceEn ?? ''}
                      disabled={disabled}
                      placeholder="Input Here"
                      onChange={(v) => update(i, { sourceEn: v })}
                      className="text-[10.5px] italic text-[var(--color-ink-3)]"
                    />
                  </td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableText value={c.micOrDi} mono disabled={disabled} onChange={(v) => update(i, { micOrDi: v })} />
                  </td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableSelect
                      value={c.standType}
                      options={STAND_OPTIONS}
                      disabled={disabled}
                      onChange={(v) => update(i, { standType: (v || undefined) as InputChannel['standType'] })}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-center align-top">
                    <input
                      type="checkbox"
                      checked={!!c.phantom48v}
                      disabled={disabled}
                      onChange={(e) => update(i, { phantom48v: e.target.checked })}
                      className="accent-[var(--color-ink)] disabled:opacity-100"
                    />
                  </td>
                  <td className="px-1.5 py-1 align-top">
                    <EditableText
                      value={c.wirelessSystem ?? ''}
                      disabled={disabled}
                      placeholder="Input Here"
                      onChange={(v) => update(i, { wirelessSystem: v, wireless: v.trim().length > 0 })}
                      className="text-[11px] text-[var(--color-ink-3)]"
                    />
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    {hasFlags &&
                      c.extractionFlags!.map((f, j) => (
                        <span
                          key={j}
                          className="block text-[10.5px] text-[var(--color-accent)] leading-snug"
                          title={f.message}
                        >
                          <Icon.Alert size={9} className="inline -mt-0.5 mr-1" />
                          {f.message}
                          <ExplainTag
                            title="Why this line is flagged"
                            ariaLabel="Explain this extraction flag"
                            riderLink={{ section: 'input_list', label: 'Open the input list in the rider' }}
                          >
                            <p>The AI that read this rider wasn't fully sure about this line and flagged it for review before the channel list is approved.</p>
                            <p>The specific concern: <strong>{f.message}</strong></p>
                            <p>Open the rider to confirm what it actually says, then correct the row if needed.</p>
                          </ExplainTag>
                        </span>
                      ))}
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    <LastEditedCell stamp={c.lastEditedAt} history={history} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonitorMixReview({
  mixes,
  onChange,
  disabled,
  history,
  userName,
}: {
  mixes: MonitorMix[];
  onChange: (mixes: MonitorMix[]) => void;
  disabled: boolean;
  history: SectionEditRecord[];
  userName: string;
}) {
  const [editedFilter, setEditedFilter] = useState<'all' | 'edited' | 'unedited'>('all');

  const update = (i: number, patch: Partial<MonitorMix>) => {
    const updated = mixes.map((m, idx) => idx === i ? { ...m, ...patch, lastEditedAt: { at: MOCK_NOW, by: userName } } : m);
    onChange(updated);
  };

  const visible = mixes.filter((m) => {
    if (editedFilter === 'edited' && !m.lastEditedAt) return false;
    if (editedFilter === 'unedited' && m.lastEditedAt) return false;
    return true;
  });

  return (
    <div>
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        {mixes.length} stereo monitor mixes. Person names parsed from mix labels are cross-referenced against the personnel extractor.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-3 py-2 w-20">Outputs</th>
              <th className="px-3 py-2 min-w-[130px]">Mix name</th>
              <th className="px-3 py-2 min-w-[100px]">Person</th>
              <th className="px-3 py-2 w-32">Type</th>
              <th className="px-3 py-2 min-w-[100px]">Notes</th>
              <th className="px-3 py-2 w-36">
                <ColumnFilterPopup
                  label="Last edited"
                  active={editedFilter !== 'all'}
                  onClear={() => setEditedFilter('all')}
                >
                  <FilterOption label="All" selected={editedFilter === 'all'} onSelect={() => setEditedFilter('all')} />
                  <FilterOption label="Edited" selected={editedFilter === 'edited'} onSelect={() => setEditedFilter('edited')} />
                  <FilterOption label="Not edited" selected={editedFilter === 'unedited'} onSelect={() => setEditedFilter('unedited')} />
                </ColumnFilterPopup>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => {
              const i = mixes.indexOf(m);
              return (
                <tr key={i} className={cn('border-t border-[var(--color-rule-soft)]', i % 2 === 1 && 'bg-[var(--color-paper)]/40')}>
                  <td className="px-2 py-1"><EditableText value={m.outputs} mono disabled={disabled} onChange={(v) => update(i, { outputs: v })} /></td>
                  <td className="px-2 py-1"><EditableText value={m.mixName} disabled={disabled} onChange={(v) => update(i, { mixName: v })} className="font-semibold" /></td>
                  <td className="px-2 py-1"><EditableText value={m.personName ?? ''} placeholder="Input Here" disabled={disabled} onChange={(v) => update(i, { personName: v })} /></td>
                  <td className="px-2 py-1">
                    <EditableSelect
                      value={m.type}
                      options={MONITOR_TYPE_OPTIONS}
                      disabled={disabled}
                      onChange={(v) => update(i, { type: (v || 'other') as MonitorMix['type'] })}
                    />
                  </td>
                  <td className="px-2 py-1"><EditableText value={m.notes ?? ''} placeholder="Input Here" disabled={disabled} onChange={(v) => update(i, { notes: v })} className="text-[var(--color-ink-3)]" /></td>
                  <td className="px-2 py-1.5 align-top">
                    <LastEditedCell stamp={m.lastEditedAt} history={history} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FOHOutputsReview({
  outputs,
  onChange,
  disabled,
  history,
  userName,
}: {
  outputs: FOHOutput[];
  onChange: (outputs: FOHOutput[]) => void;
  disabled: boolean;
  history: SectionEditRecord[];
  userName: string;
}) {
  const [editedFilter, setEditedFilter] = useState<'all' | 'edited' | 'unedited'>('all');

  const update = (i: number, patch: Partial<FOHOutput>) => {
    const updated = outputs.map((o, idx) => idx === i ? { ...o, ...patch, lastEditedAt: { at: MOCK_NOW, by: userName } } : o);
    onChange(updated);
  };

  const visible = outputs.filter((o) => {
    if (editedFilter === 'edited' && !o.lastEditedAt) return false;
    if (editedFilter === 'unedited' && o.lastEditedAt) return false;
    return true;
  });

  return (
    <div>
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        {outputs.length} FOH outputs. SMPTE, talkback, light/video sends, and the main + sub + fill bus.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden">
          <thead className="bg-[var(--color-paper-2)]/40">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              <th className="px-3 py-2 w-20">Output</th>
              <th className="px-3 py-2 min-w-[140px]">Source</th>
              <th className="px-3 py-2 min-w-[120px]">Notes</th>
              <th className="px-3 py-2 w-36">
                <ColumnFilterPopup
                  label="Last edited"
                  active={editedFilter !== 'all'}
                  onClear={() => setEditedFilter('all')}
                >
                  <FilterOption label="All" selected={editedFilter === 'all'} onSelect={() => setEditedFilter('all')} />
                  <FilterOption label="Edited" selected={editedFilter === 'edited'} onSelect={() => setEditedFilter('edited')} />
                  <FilterOption label="Not edited" selected={editedFilter === 'unedited'} onSelect={() => setEditedFilter('unedited')} />
                </ColumnFilterPopup>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const i = outputs.indexOf(o);
              return (
                <tr key={i} className={cn('border-t border-[var(--color-rule-soft)]', i % 2 === 1 && 'bg-[var(--color-paper)]/40')}>
                  <td className="px-2 py-1"><EditableText value={o.outputNumber} mono disabled={disabled} onChange={(v) => update(i, { outputNumber: v })} /></td>
                  <td className="px-2 py-1"><EditableText value={o.source} disabled={disabled} onChange={(v) => update(i, { source: v })} /></td>
                  <td className="px-2 py-1"><EditableText value={o.notes ?? ''} placeholder="Input Here" disabled={disabled} onChange={(v) => update(i, { notes: v })} className="text-[var(--color-ink-3)]" /></td>
                  <td className="px-2 py-1.5 align-top">
                    <LastEditedCell stamp={o.lastEditedAt} history={history} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BacklineReview({ backline }: { backline: NonNullable<RiderSection['backline']> }) {
  return (
    <div className="space-y-5 text-[12.5px]">
      {backline.drums && (
        <BlockSub title="Drums">
          <div>
            <Label>Kit options</Label>
            <div className="text-[var(--color-ink-2)]">{backline.drums.kitOptions.join(' · ')}</div>
          </div>
          <div>
            <Label>Pieces</Label>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5 mt-0.5">
              {backline.drums.pieces.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-[var(--color-ink-2)] capitalize">{p.type.replace('_', ' ')}</span>
                  <span className="font-mono text-[var(--color-ink-2)]">{p.size}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Hardware</Label>
            <ul className="space-y-1 mt-0.5">
              {backline.drums.hardware.map((h, i) => {
                const hasExcl = (h.excluded?.length ?? 0) > 0;
                return (
                  <li key={i} className={cn('px-2.5 py-1.5 border border-[var(--color-rule-soft)] rounded-[3px]', hasExcl && 'border-[rgba(184,57,43,0.35)] bg-[rgba(184,57,43,0.03)]')}>
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-[var(--color-ink)]">
                        {h.item} <span className="font-mono text-[var(--color-ink-3)]">×{h.qty}</span>
                      </span>
                      {h.preferred && h.preferred.length > 0 && (
                        <span className="text-[11px] text-[var(--color-ink-3)]">Preferred: {h.preferred.join(', ')}</span>
                      )}
                    </div>
                    {h.excluded && h.excluded.length > 0 && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-accent)]">
                        <Icon.X size={10} /> Excluded: {h.excluded.join(', ')}
                        <ExcludedBrandExplain section="backline" />
                      </div>
                    )}
                    {h.notes && <div className="text-[11px] text-[var(--color-ink-3)] mt-0.5 italic">{h.notes}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        </BlockSub>
      )}

      {backline.bass && (
        <BlockSub title="Bass">
          <ul className="space-y-1">
            {backline.bass.options.map((o) => (
              <li key={o.optionNumber} className="grid grid-cols-[auto_1fr_1fr] gap-3 items-center px-2.5 py-1.5 border border-[var(--color-rule-soft)] rounded-[3px]">
                <span className="font-mono text-[11px] text-[var(--color-ink-3)] uppercase tracking-[0.10em]">Opt {o.optionNumber}</span>
                <span><span className="text-[11px] text-[var(--color-ink-3)]">Head: </span>{o.head}</span>
                <span><span className="text-[11px] text-[var(--color-ink-3)]">Cab: </span>{o.cab}</span>
              </li>
            ))}
          </ul>
        </BlockSub>
      )}

      {backline.guitar && (
        <BlockSub title="Guitar amps">
          <ul className="space-y-1">
            {backline.guitar.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 px-2.5 py-1.5 border border-[var(--color-rule-soft)] rounded-[3px]">
                <span>{g.item} <span className="font-mono text-[var(--color-ink-3)]">×{g.qty}</span></span>
                <span className="text-[11px] text-[var(--color-ink-3)]">{g.notes ?? ''}</span>
              </li>
            ))}
          </ul>
        </BlockSub>
      )}

      {backline.miscellaneous && (
        <BlockSub title="Miscellaneous">
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {backline.miscellaneous.map((m, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-[var(--color-ink-2)]">{m.item}</span>
                <span className="font-mono text-[var(--color-ink-2)]">×{m.qty}</span>
              </li>
            ))}
          </ul>
        </BlockSub>
      )}

      {backline.videoScreen && (
        <BlockSub title="Video screen">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <KV k="Type" v={backline.videoScreen.type} />
            <KV k="Dimensions" v={backline.videoScreen.dimensions} />
            <KV k="Aspect" v={backline.videoScreen.aspectRatio} />
            <KV k="Resolution" v={`${backline.videoScreen.resolutionPreferred} (min ${backline.videoScreen.resolutionMin})`} />
          </div>
        </BlockSub>
      )}
    </div>
  );
}

function LodgingReview({ lodging }: { lodging: NonNullable<RiderSection['lodging']> }) {
  return (
    <div>
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Rooming list reveals the touring party. {lodging.totalRooms ?? '—'} rooms, {lodging.totalOccupants ?? '—'} occupants.
        {lodging.hotelRequirements?.artistPreApproval && ' Artist pre-approval required.'}
      </p>
      <ul className="space-y-1.5">
        {lodging.roomingList.map((r) => (
          <li key={r.roomNumber} className="flex items-baseline gap-3 px-2.5 py-1.5 border border-[var(--color-rule-soft)] rounded-[3px]">
            <span className="font-mono text-[11.5px] tabular text-[var(--color-ink-3)] w-8">#{r.roomNumber}</span>
            <Chip tone="neutral" size="sm" variant="outline">
              {r.roomType.replace('_', ' ')}
            </Chip>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {r.occupants.map((o, i) => (
                <span key={i}>
                  {o.name ? (
                    <>
                      <span className="font-semibold text-[var(--color-ink)]">{o.name}</span>
                      <span className="text-[11px] text-[var(--color-ink-3)] ml-1.5">· {o.role.replace('_', ' ')}</span>
                    </>
                  ) : (
                    <span className="text-[var(--color-ink-3)] italic">{o.role.replace('_', ' ')}</span>
                  )}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CateringReview({ catering }: { catering: NonNullable<RiderSection['catering']> }) {
  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        {catering.menus.length} menus by room × time-of-day. Excluded brands and dietary tags captured verbatim — they're as important as positive specs.
      </p>
      {catering.menus.map((menu, i) => (
        <BlockSub key={i} title={`${menu.room} · ${menu.menuTime.replace('_', ' ')}`}>
          {menu.availableBy && (
            <div className="text-[11px] text-[var(--color-ink-3)] italic mb-2">
              Available: {menu.availableBy}
            </div>
          )}
          <ul className="space-y-0.5 text-[12.5px]">
            {menu.items.map((item, j) => {
              const hasExcl = (item.brandExcluded?.length ?? 0) > 0;
              return (
                <li key={j} className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5', hasExcl && 'bg-[rgba(184,57,43,0.03)]')}>
                  <span className="text-[var(--color-ink)]">{item.item}</span>
                  {item.itemEn && item.itemEn !== item.item && (
                    <span className="text-[10.5px] italic text-[var(--color-ink-3)]">({item.itemEn})</span>
                  )}
                  <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                    ×{item.qty}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                  {item.brandPreferred && item.brandPreferred.length > 0 && (
                    <span className="text-[10.5px] text-[var(--color-ink-3)]">
                      → {item.brandPreferred.join(', ')}
                    </span>
                  )}
                  {hasExcl && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--color-accent)]">
                      <Icon.X size={9} /> NOT {item.brandExcluded!.join(', ')}
                      <ExcludedBrandExplain section="catering" />
                    </span>
                  )}
                  {item.dietaryTags && item.dietaryTags.length > 0 && (
                    <span className="text-[10px] font-mono uppercase tracking-[0.10em] text-[var(--color-ink-4)]">
                      {item.dietaryTags.join(' · ').replace(/_/g, ' ')}
                    </span>
                  )}
                  {item.notes && <span className="text-[10.5px] italic text-[var(--color-ink-3)]">— {item.notes}</span>}
                </li>
              );
            })}
          </ul>
        </BlockSub>
      ))}
      {catering.generalRequirements && (
        <div className="border-t border-[var(--color-rule-soft)] pt-3 text-[12px] text-[var(--color-ink-3)]">
          <span className="eyebrow mr-2">General</span>
          {catering.generalRequirements.biodegradableDisposables && '· Biodegradable disposables '}
          {catering.generalRequirements.foodDonationPlanRequired && '· Food donation plan required '}
        </div>
      )}
    </div>
  );
}

function ConflictsReview({ conflicts }: { conflicts: Conflict[] }) {
  const { resolvedConflicts, getPendingConflictResolution, user } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const [active, setActive] = useState<Conflict | null>(null);

  if (conflicts.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-ink-3)]">No conflicts detected.</p>;
  }
  const unresolvedCount = conflicts.filter((c) => !resolvedConflicts.has(c.id)).length;
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
        Cross-section comparison detected {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} ·{' '}
        <span className="text-[var(--color-ink)] font-semibold">{unresolvedCount} unresolved</span>.
        Never auto-resolved — humans always decide. Click <strong>Resolve</strong> on a row to record the
        correct value.
      </p>
      {conflicts.map((c) => {
        const res = resolvedConflicts.get(c.id);
        const pending = getPendingConflictResolution(c.id);
        return (
          <div
            key={c.id}
            className={cn(
              'border-l-4 px-4 py-3 rounded-[3px]',
              res
                ? 'bg-[var(--color-paper-2)]/15 opacity-75'
                : 'bg-[var(--color-paper-2)]/30',
            )}
            style={{
              borderLeftColor: res
                ? 'var(--color-moss)'
                : c.severity === 'high'
                ? 'var(--color-accent)'
                : c.severity === 'medium'
                ? 'var(--color-day-rehearsal)'
                : 'var(--color-ink-4)',
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {res ? (
                  <Chip tone="success" size="sm">
                    <Icon.Check size={9} /> Resolved
                  </Chip>
                ) : pending ? (
                  <Chip tone="rehearsal" size="sm" variant="outline">
                    Pending
                  </Chip>
                ) : (
                  <Chip
                    tone={c.severity === 'high' ? 'critical' : c.severity === 'medium' ? 'rehearsal' : 'neutral'}
                    size="sm"
                  >
                    {c.severity}
                  </Chip>
                )}
                <Chip tone="neutral" size="sm" variant="outline">
                  {c.type.replace('_', ' ')}
                </Chip>
                <span className="inline-flex items-baseline gap-1 text-[12px] font-semibold">
                  {c.sectionsInvolved.map((s, i) => (
                    <span key={s} className="inline-flex items-baseline gap-1">
                      {i > 0 && <span className="text-[var(--color-ink-4)]">↔</span>}
                      <RiderRef section={s} />
                    </span>
                  ))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActive(c)}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)] hover:border-[var(--color-ink-4)] text-[var(--color-ink)] shrink-0"
              >
                {res ? 'View resolution' : pending ? 'View' : managerView ? 'Resolve' : 'Propose'} <Icon.Arrow size={11} />
              </button>
            </div>
            <div className={cn('text-[13px] font-semibold text-[var(--color-ink)]', res && 'line-through')}>
              {linkifyRiderRefs(c.description)}
              <ConflictExplain conflict={c} />
            </div>
            <ul className="mt-2 space-y-1">
              {c.values.map((v, i) => (
                <li key={i} className="text-[12px] flex gap-2">
                  <span className="font-mono text-[var(--color-ink-3)] shrink-0">{linkifyRiderRefs(v.section)}:</span>
                  <span className="text-[var(--color-ink-2)]">{v.value}</span>
                </li>
              ))}
            </ul>
            {res ? (
              <div className="mt-2 pt-2 border-t border-[var(--color-rule-soft)] text-[12px]">
                {res.proposedAt && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mb-0.5">
                    Proposed by {res.proposedAt.by} · {new Date(res.proposedAt.at).toLocaleString()}
                  </div>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-moss)] mr-1.5">
                  ✓ Resolved
                </span>
                <span className="font-semibold text-[var(--color-ink)]">{res.chosenValue}</span>
                <span className="text-[var(--color-ink-3)] ml-1.5 text-[11px]">
                  · {res.resolvedBy} · {new Date(res.resolvedAt).toLocaleString()}
                </span>
                {res.note && (
                  <div className="text-[11.5px] text-[var(--color-ink-3)] italic mt-0.5">"{res.note}"</div>
                )}
              </div>
            ) : pending ? (
              <div className="mt-2 pt-2 border-t border-[var(--color-rule-soft)] text-[12px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-[var(--color-accent)] mr-1.5">
                  ⏳ Pending
                </span>
                <span className="font-semibold text-[var(--color-ink)]">{pending.chosenValue}</span>
                <span className="text-[var(--color-ink-3)] ml-1.5 text-[11px]">
                  · proposed by {pending.proposedAt.by} · {new Date(pending.proposedAt.at).toLocaleString()}
                </span>
              </div>
            ) : (
              c.suggestedResolution && (
                <div className="mt-2 pt-2 border-t border-[var(--color-rule-soft)] text-[12px] text-[var(--color-ink-2)]">
                  <span className="eyebrow mr-1.5">Suggested</span>
                  {linkifyRiderRefs(c.suggestedResolution)}
                </div>
              )
            )}
          </div>
        );
      })}
      <ConflictResolveModal conflict={active} onClose={() => setActive(null)} />
    </div>
  );
}

function FreeTextReview({
  es,
  en,
  onChangeEs,
  onChangeEn,
  disabled,
}: {
  es?: string;
  en?: string;
  onChangeEs: (v: string) => void;
  onChangeEn: (v: string) => void;
  disabled: boolean;
}) {
  const taClass = cn(
    'w-full text-[13px] leading-[1.55] bg-transparent border-l-2 border-[var(--color-rule)] pl-3 py-1 rounded-r-[2px] outline-none resize-y',
    !disabled && 'hover:bg-[var(--color-paper-2)]/40 focus:bg-[var(--color-card)] focus:border-[var(--color-ocean)]',
  );
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="eyebrow mb-1.5">Source · ES</div>
        <textarea
          value={es ?? ''}
          disabled={disabled}
          rows={5}
          placeholder="Input Here"
          onChange={(e) => onChangeEs(e.target.value)}
          className={cn(taClass, 'text-[var(--color-ink-2)]')}
        />
      </div>
      <div>
        <div className="eyebrow mb-1.5">Translation · EN</div>
        <textarea
          value={en ?? ''}
          disabled={disabled}
          rows={5}
          placeholder="Input Here"
          onChange={(e) => onChangeEn(e.target.value)}
          className={cn(taClass, 'text-[var(--color-ink-2)] italic')}
        />
      </div>
    </div>
  );
}

function BlockSub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-[15px] font-bold text-[var(--color-ink)] mb-2 pb-1 border-b border-[var(--color-rule-soft)]">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-0.5">{children}</div>;
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <Label>{k}</Label>
      <div className="text-[var(--color-ink-2)]">{v}</div>
    </div>
  );
}

// Scratch-mode upload zone, shown when no rider has been imported yet.
function ScratchRiderUpload() {
  const { addRiderImportToScratch } = useApp();
  const [note, setNote] = useState<UploadNote | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const riderFixture = fixturesOfKind('rider')[0];

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    setIsParsing(true);
    try {
      const parsed = await parseRiderPdf(file);
      addRiderImportToScratch(parsed, buildScratchRiderPersonnel());
    } catch {
      // Parsing failed — fall back to fixture if this looks like the right file.
      const fixture = matchFixture(file.name);
      if (fixture?.kind === 'rider') {
        addRiderImportToScratch(buildScratchRiderImport(), buildScratchRiderPersonnel());
      } else {
        setNote(nonMatchNote(file, fixture, 'a rider PDF', riderFixture.filename));
      }
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <FileDropZone
        accept=".pdf"
        onFiles={handleFiles}
        title={isParsing ? 'Parsing PDF…' : 'Drop the rider PDF'}
        hint={isParsing ? 'Extracting sections — this takes a few seconds.' : `Upload "${riderFixture.filename}" — ${riderFixture.extracts}`}
        icon={<Icon.Sparkle size={22} />}
        tourAnchor="rider-dropzone"
      />
      {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
    </div>
  );
}
