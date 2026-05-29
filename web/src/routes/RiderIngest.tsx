import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/state/AppState';
import type { PendingEdit } from '@/state/AppState';
import { MOCK_NOW } from '@/lib/today';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EditableText, EditableSelect } from '@/components/ui/EditableText';
import { SourceTag } from '@/components/provenance/SourceTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { ExplainTag, ExcludedBrandExplain } from '@/components/ExplainTag';
import { LastUpdated } from '@/components/LastUpdated';
import { usePdfViewer, PdfViewerInline } from '@/components/PdfViewer';
import { FileDropZone } from '@/components/ingest/FileDropZone';
import { UploadResultNote } from '@/components/ingest/UploadResultNote';
import type { UploadNote } from '@/components/ingest/UploadResultNote';
import { RIDER_PDF_PATH } from '@/lib/riderSections';
import { matchFixture } from '@/lib/fixtureMatcher';
import { buildScratchRiderImport, buildScratchRiderPersonnel, hydrateRiderPlotImages } from '@/data/riderFixture';
import { parseRiderPdf } from '@/lib/pdfParser';
import { saveRiderPdf } from '@/lib/riderPdfStore';
import { cn } from '@/lib/cn';
import type {
  RiderImport,
  RiderSection,
  RiderSectionType,
  RiderSectionStatus,
  InputChannel,
  MonitorMix,
  FOHOutput,
  SectionEditRecord,
  UpdateStamp,
} from '@/types';

// Active rider PDF URL — Blob URL of the user's uploaded file. Returns
// `undefined` when no rider has been imported (and there is no canonical
// fallback). Every "open the rider PDF" affordance pivots on this; when it's
// undefined, consumers hide the affordance instead of opening a stale fixture.
function useActiveRiderPdfUrl(): string | undefined {
  const { tour } = useApp();
  return tour.riderImports[0]?.pdfObjectUrl;
}

// Friendly English fallback labels per RiderSectionType — used only when a
// section has no TOC-verbatim title (legacy data, derived "other", etc.).
// New TOC-driven sections render `section.title` verbatim instead.
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
  other: 'Other',
};

/** TOC-verbatim title when present (the rider's own language), else the fallback. */
function sectionLabel(s: RiderSection): string {
  return s.title?.trim() || SECTION_LABELS[s.type];
}

/** All plot images across every section — drives the "Plots" tab. */
function collectPlots(imp: RiderImport): Array<{ sectionKey: string; section: RiderSection; plot: import('@/types').PlotImage }> {
  const out: Array<{ sectionKey: string; section: RiderSection; plot: import('@/types').PlotImage }> = [];
  imp.sections.forEach((s, i) => {
    for (const plot of s.plots ?? []) out.push({ sectionKey: `${s.type}-${i}`, section: s, plot });
  });
  return out;
}

/** Group plot images by their owning section — one card per section in the
 *  Plots tab + the /plots route, opening a fullscreen image lightbox over
 *  that section's pages only. */
export function collectPlotsBySection(
  imp: RiderImport,
): Array<{ sectionKey: string; section: RiderSection; plots: import('@/types').PlotImage[] }> {
  const out: Array<{ sectionKey: string; section: RiderSection; plots: import('@/types').PlotImage[] }> = [];
  imp.sections.forEach((s, i) => {
    if (s.plots && s.plots.length > 0) {
      out.push({ sectionKey: `${s.type}-${i}`, section: s, plots: s.plots });
    }
  });
  return out;
}

// Hook-context guard: this is a React component, so useActiveRiderPdfUrl() is valid.
export function RiderIngest() {
  const { tour, isSectionApproved, getPendingEdit } = useApp();
  const { openPdf } = usePdfViewer();
  const pdfUrl = useActiveRiderPdfUrl();
  const imp = tour.riderImports[0];

  // Active selection: either a section key (`type-index`) or the special "plots" sentinel.
  // The trailing "other"-type conflicts pseudo-section is excluded — it lived
  // here as a rail entry but felt overkill at the section-review altitude.
  const [active, setActive] = useState<string>(() => {
    if (!imp) return 'plots';
    const first = imp.sections.find((s) => s.type !== 'other');
    if (!first) return 'plots';
    const idx = imp.sections.indexOf(first);
    return `${first.type}-${idx}`;
  });
  const [isReuploading, setIsReuploading] = useState(false);
  const [approvedExpanded, setApprovedExpanded] = useState(false);

  if (!imp || isReuploading) {
    return (
      <div>
        <PageHeader
          eyebrow="Import rider"
          title="Rider import"
          description="Drop a rider PDF — the parser reads the table of contents and produces one review surface per section."
          actions={isReuploading && (
            <Button variant="outline" onClick={() => setIsReuploading(false)}>
              Cancel
            </Button>
          )}
        />
        <ScratchRiderUpload onDone={() => setIsReuploading(false)} />
      </div>
    );
  }

  // The 14 TOC entries keyed by `type-index`. Sort by tocIndex when present so
  // the rail reads §1 → §14 even if section order in the import is shuffled.
  // Any legacy "other"-type pseudo-section (the old conflicts rail entry) is
  // dropped — its rail surface was removed; conflict data still flows through
  // the Tour Overview's ConflictFeed via AppState.
  const sectionRows = imp.sections
    .map((s, i) => ({ s, i, key: `${s.type}-${i}` }))
    .filter(({ s }) => s.type !== 'other')
    .sort((a, b) => {
      const ai = a.s.tocIndex ?? 99;
      const bi = b.s.tocIndex ?? 99;
      return ai - bi;
    });
  const approvedRows = sectionRows.filter(({ key }) => isSectionApproved(key));
  const unapprovedRows = sectionRows.filter(({ key }) => !isSectionApproved(key));
  const approvedCount = approvedRows.length;
  const totalCount = sectionRows.length;
  const plots = collectPlots(imp);

  const activeSection = active !== 'plots'
    ? sectionRows.find((r) => r.key === active)?.s
    : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Import rider"
        title="Rider import"
        description="Read each section in the rider against the parser's extraction and approve it. The PDF on the left is the source; the extracted text on the right is editable."
        actions={
          <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setIsReuploading(true)}>
            Upload rider
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {pdfUrl ? (
              <button
                type="button"
                onClick={() => openPdf({ url: pdfUrl, title: imp.filename })}
                title="View the rider PDF"
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Chip tone="critical">
                  <Icon.Document size={10} /> {imp.filename}
                </Chip>
              </button>
            ) : (
              <Chip tone="critical">
                <Icon.Document size={10} /> {imp.filename}
              </Chip>
            )}
            <Chip tone="neutral" variant="outline">
              <Icon.Document size={10} /> {imp.pageCount} pages
            </Chip>
            <Chip tone="travel" variant="outline">
              Source: {imp.sourceLanguage.toUpperCase()}
            </Chip>
            <Chip tone="rehearsal">Revision {imp.revision}</Chip>
            <Chip tone="neutral" variant="outline">
              {approvedCount}/{imp.sections.length} approved
            </Chip>
          </div>
        }
      />

      {/* Cover & revision banner */}
      <CoverBanner imp={imp} />

      <div className="grid lg:grid-cols-[240px_1fr] gap-5 mt-6">
        {/* Left rail — TOC-ordered section list + Plots entry */}
        <Card padded={false} className="overflow-hidden">
          <div data-tour="rider-sections" className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
            <div className="eyebrow">Sections to review</div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {unapprovedRows.length === 0
                ? `All ${totalCount} approved`
                : `${unapprovedRows.length} of ${totalCount} remaining`}
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-rule-soft)] max-h-[680px] overflow-y-auto">
            {unapprovedRows.length === 0 && (
              <li className="px-4 py-6 text-center">
                <div className="text-[12px] text-[var(--color-ink-3)] italic">
                  Every section has been approved.
                </div>
              </li>
            )}
            {unapprovedRows.map(({ s, key }) => (
              <SectionRailItem
                key={key}
                section={s}
                active={key === active}
                onSelect={() => setActive(key)}
                pendingEdit={!!getPendingEdit(key)}
                approved={false}
              />
            ))}
            {plots.length > 0 && (
              <li>
                <button
                  onClick={() => setActive('plots')}
                  className={cn(
                    'w-full text-left px-4 py-2.5 hover:bg-[var(--color-paper)]/60 transition-colors',
                    active === 'plots' && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold inline-flex items-center gap-1.5">
                      <Icon.Document size={11} /> Plots
                    </span>
                  </div>
                  <div
                    className={cn(
                      'mt-1 text-[10.5px] font-mono tabular',
                      active === 'plots' ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-4)]',
                    )}
                  >
                    {plots.length} image page{plots.length === 1 ? '' : 's'}
                  </div>
                </button>
              </li>
            )}
          </ul>
        </Card>

        {/* Right side — Approved-sections card + Plots grid OR section two-pane review */}
        <div className="min-w-0 space-y-4">
          {totalCount > 0 && (
            <Card padded={false} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setApprovedExpanded((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--color-paper)]/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon.Check size={12} />
                  <span className="text-[12.5px] font-semibold">
                    Approved sections
                  </span>
                  <span className="font-mono tabular text-[11px] text-[var(--color-ink-3)]">
                    {approvedCount}/{totalCount}
                  </span>
                </div>
                <span className="font-mono uppercase tracking-[0.10em] text-[10px] text-[var(--color-ink-3)] inline-flex items-center gap-1">
                  {approvedExpanded ? 'Hide' : 'Show'}
                  <Icon.Arrow size={9} className={approvedExpanded ? 'rotate-90' : ''} />
                </span>
              </button>
              {approvedExpanded && (
                <ul className="border-t border-[var(--color-rule-soft)] divide-y divide-[var(--color-rule-soft)] max-h-[280px] overflow-y-auto">
                  {approvedRows.length === 0 ? (
                    <li className="px-4 py-4 text-[12px] italic text-[var(--color-ink-3)] text-center">
                      No sections approved yet.
                    </li>
                  ) : (
                    approvedRows.map(({ s, key }) => (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => setActive(key)}
                          className={cn(
                            'w-full text-left px-4 py-2 hover:bg-[var(--color-paper)]/60 transition-colors flex items-center justify-between gap-3',
                            key === active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                          )}
                        >
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className={cn(
                              'font-mono tabular text-[11px] shrink-0',
                              key === active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-3)]',
                            )}>
                              §{s.tocIndex ?? '?'}
                            </span>
                            <span className="text-[12.5px] font-semibold truncate">
                              {sectionLabel(s)}
                            </span>
                          </div>
                          <span className={cn(
                            'shrink-0 font-mono uppercase tracking-[0.10em] text-[10px]',
                            key === active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-4)]',
                          )}>
                            Approved
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </Card>
          )}

          {active === 'plots' ? (
            <PlotsPanel imp={imp} />
          ) : activeSection && active !== 'plots' ? (
            <SectionReviewSplit
              section={activeSection}
              sectionKey={active}
              sourceLang={imp.sourceLanguage}
            />
          ) : null}
        </div>
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
        intro="Every section on this page is REAL data extracted from the Elsa y Elmar rider PDF. The parser reads the rider's own table of contents to produce one review surface per section, then applies typed extractors where it can (input list, rooming, catering)."
      />
    </div>
  );
}

function SectionRailItem({
  section,
  active,
  onSelect,
  pendingEdit,
  approved,
}: {
  section: RiderSection;
  active: boolean;
  onSelect: () => void;
  pendingEdit: boolean;
  approved: boolean;
}) {
  const label = sectionLabel(section);
  const hasConflicts = (section.conflicts?.length ?? 0) > 0;
  const num = section.tocIndex;
  return (
    <li className={cn(hasConflicts && !active && 'border-l-2 border-[var(--color-accent)]')}>
      <button
        onClick={onSelect}
        className={cn(
          'w-full text-left px-4 py-2.5 hover:bg-[var(--color-paper)]/60 transition-colors',
          active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
          hasConflicts && active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold inline-flex items-baseline gap-1.5 min-w-0">
            {hasConflicts && (
              <Icon.Alert size={10} className={cn('shrink-0', active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-accent)]')} />
            )}
            {num != null && (
              <span
                className={cn(
                  'font-mono text-[10px] tabular shrink-0',
                  active ? 'text-[var(--color-paper)] opacity-70' : 'text-[var(--color-ink-4)]',
                )}
              >
                §{num}
              </span>
            )}
            <span className="truncate">{label}</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {pendingEdit && (
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
            <SectionStatusDot status={approved ? 'approved' : section.status} />
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 mt-1 text-[10.5px] font-mono tabular',
            active ? 'text-[var(--color-paper)] opacity-80' : 'text-[var(--color-ink-4)]',
          )}
        >
          <span>{section.pages.length > 0 ? `pp. ${section.pages[0]}${section.endPage && section.endPage !== section.pages[0] ? `–${section.endPage}` : ''}` : 'derived'}</span>
          {section.confidence != null && <span>· conf {(section.confidence * 100).toFixed(0)}%</span>}
        </div>
      </button>
    </li>
  );
}

function SectionReviewSplit({
  section,
  sectionKey,
  sourceLang,
}: {
  section: RiderSection;
  sectionKey: string;
  sourceLang: string;
}) {
  const pdfUrl = useActiveRiderPdfUrl();
  // Plot sections (stage plot / lightplot) are CAD drawings, not text. Skip
  // the source PDF iframe + the text-extraction surface entirely and render
  // the rendered plot images as a single-pane review.
  const isPlotSection =
    section.type === 'stage_plot' ||
    section.type === 'lighting_plot' ||
    (section.plots?.length ?? 0) > 0;
  if (isPlotSection) {
    return (
      <div className="min-w-0">
        <PlotSectionReview section={section} sectionKey={sectionKey} />
      </div>
    );
  }

  // Always render the side-by-side when the section is anchored to pages — the
  // user wants a stable two-pane shape so they can compare source to extracted
  // text. If the live PDF URL hasn't resolved yet (boot rehydration pending or
  // upload bytes missing), show a placeholder card in the left slot instead of
  // collapsing the layout. Conflicts-pseudo sections with zero source pages
  // still drop to single column.
  const hasPages = section.pages.length > 0;
  const pageRange = hasPages
    ? `pages ${section.pages[0]}${section.endPage && section.endPage !== section.pages[0] ? `–${section.endPage}` : ''}`
    : '';
  return (
    <div className={cn('grid gap-5 min-w-0', hasPages ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'lg:grid-cols-1')}>
      {hasPages && (
        <div className="space-y-2 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="eyebrow">Source · {pageRange}</div>
          </div>
          {pdfUrl ? (
            <PdfViewerInline
              url={pdfUrl}
              page={section.pages[0]}
              title={sectionLabel(section)}
              height="50vh"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-[var(--color-rule)] bg-[var(--color-paper-2)]/40 text-center px-4" style={{ height: '50vh' }}>
              <Icon.Document size={22} className="text-[var(--color-ink-4)]" />
              <p className="text-[12.5px] font-semibold text-[var(--color-ink)]">Source PDF unavailable</p>
              <p className="text-[11.5px] text-[var(--color-ink-3)] max-w-xs">
                The rider was imported earlier but the PDF bytes aren't in this browser. Re-upload the rider to restore the side-by-side viewer.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="space-y-5 min-w-0">
        <SectionView section={section} sectionKey={sectionKey} sourceLang={sourceLang} />
      </div>
    </div>
  );
}

/**
 * Plot-section review surface — used when the selected section is a stage
 * plot or lightplot. No text extraction, no editable fields: the reviewer is
 * confirming the right images came across, then approving them.
 */
function PlotSectionReview({
  section,
  sectionKey,
}: {
  section: RiderSection;
  sectionKey: string;
}) {
  const {
    user,
    isSectionApproved,
    getSectionApproval,
    approveSection,
    reopenSection,
  } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const approved = isSectionApproved(sectionKey);
  const approval = getSectionApproval(sectionKey);
  const effStatus: RiderSectionStatus = approved ? 'approved' : section.status;
  const label = sectionLabel(section);
  const plots = section.plots ?? [];
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  return (
    <SectionCard
      title={
        <span className="inline-flex items-baseline gap-2">
          {section.tocIndex != null && (
            <span className="font-mono text-[12px] text-[var(--color-ink-4)] tabular">§{section.tocIndex}</span>
          )}
          <span>{label}</span>
        </span>
      }
      eyebrow={
        <span className="inline-flex items-baseline">
          <SectionPageLinks pages={section.pages} sectionLabel={label} />
          Plot images
        </span>
      }
      action={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <SectionStatusChip status={effStatus} />
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
              Approve images
            </Button>
          ))}
        </div>
      }
    >
      {approved && approval ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-[3px] border border-[var(--color-moss)]/35 bg-[var(--color-moss)]/8 px-2.5 py-1.5">
          <Icon.Check size={12} className="text-[var(--color-moss)] shrink-0" />
          <LastUpdated label="Approved" stamp={approval} />
        </div>
      ) : (
        <p className="mb-4 text-[11.5px] text-[var(--color-ink-3)] leading-relaxed">
          {managerView
            ? 'Confirm these are the right plot images for this section, then approve.'
            : 'Plot images extracted from the rider — read-only.'}
        </p>
      )}
      {plots.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-3)] italic">No plot images detected for this section.</p>
      ) : (
        <div className="space-y-4">
          {plots.map((plot, i) => {
            const imgBlock = plot.dataUrl ? (
              <img src={plot.dataUrl} alt={plot.caption} className="block w-full h-auto" />
            ) : (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-[var(--color-ink-3)]">
                <Icon.Document size={22} />
                <span className="text-[12px] font-semibold">Rendering page {plot.page}…</span>
              </div>
            );
            return (
              <figure
                key={`${plot.page}-${i}`}
                className="rounded-[4px] border border-[var(--color-rule-soft)] overflow-hidden bg-[var(--color-paper-2)]"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="block w-full text-left"
                  title={`View page ${plot.page} fullscreen`}
                >
                  {imgBlock}
                </button>
                <figcaption className="px-3 py-2 flex items-center justify-between gap-2 text-[11px] border-t border-[var(--color-rule-soft)] bg-[var(--color-card)]">
                  <span className="font-mono uppercase tracking-[0.10em] text-[var(--color-ink-3)]">
                    {plot.caption} · page {plot.page}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--color-ocean)] hover:underline"
                  >
                    View fullscreen <Icon.Arrow size={11} />
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
      <PlotImageLightbox
        open={lightboxIdx != null}
        onClose={() => setLightboxIdx(null)}
        section={section}
        plots={plots}
        initialIndex={lightboxIdx ?? 0}
      />
    </SectionCard>
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

/** One card per section — preview thumb + page-range caption. Click opens
 *  the image lightbox over JUST this section's pages. */
export function SectionPlotCard({
  section,
  plots,
  onOpen,
}: {
  section: RiderSection;
  plots: import('@/types').PlotImage[];
  onOpen: () => void;
}) {
  const preview = plots.find((p) => p.dataUrl) ?? plots[0];
  const firstPage = plots[0]?.page;
  const lastPage = plots[plots.length - 1]?.page;
  const pageRange = firstPage == null
    ? ''
    : firstPage === lastPage
      ? `Page ${firstPage}`
      : `Pages ${firstPage}–${lastPage}`;
  return (
    <Card
      padded={false}
      className="overflow-hidden group ring-1 ring-transparent hover:ring-[var(--color-ocean)]/40 transition-shadow"
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full bg-[var(--color-paper-2)] aspect-[4/3] overflow-hidden relative"
        title={`Open ${plots.length} image${plots.length === 1 ? '' : 's'} for ${sectionLabel(section)}`}
      >
        {preview?.dataUrl ? (
          <img
            src={preview.dataUrl}
            alt={sectionLabel(section)}
            className="block w-full h-full object-contain"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[var(--color-ink-3)]">
            <Icon.Image size={22} />
            <span className="text-[11px] font-semibold">Rendering pages…</span>
          </div>
        )}
        {plots.length > 1 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-[rgba(15,13,11,0.72)] text-[var(--color-paper)] font-mono tabular text-[10px]">
            <Icon.Image size={9} /> {plots.length}
          </span>
        )}
      </button>
      <div className="px-3 py-2 border-t border-[var(--color-rule-soft)]">
        <div className="eyebrow truncate">
          {section.tocIndex != null ? `§${section.tocIndex}` : ''}
        </div>
        <div className="font-semibold text-[12.5px] leading-tight mt-0.5 truncate" title={sectionLabel(section)}>
          {sectionLabel(section)}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="font-mono tabular text-[10px] text-[var(--color-ink-4)]">{pageRange}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-[10.5px] text-[var(--color-ocean)] opacity-0 group-hover:opacity-100 transition-opacity">
            View <Icon.Arrow size={10} />
          </span>
        </div>
      </div>
    </Card>
  );
}

/** Fullscreen image-only lightbox over a section's plot pages. Arrow keys +
 *  on-screen prev/next; Esc closes. No PDF chrome — these are images. */
export function PlotImageLightbox({
  open,
  onClose,
  section,
  plots,
  initialIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  section: RiderSection | null;
  plots: import('@/types').PlotImage[];
  initialIndex?: number;
}) {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => { if (open) setIdx(initialIndex); }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIdx((i) => Math.min(plots.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, plots.length]);

  if (!open || !section || plots.length === 0) return null;
  if (typeof document === 'undefined' || !document.body) return null;
  const current = plots[Math.min(idx, plots.length - 1)];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex flex-col bg-[rgba(15,13,11,0.94)]"
    >
      <header className="flex items-center justify-between gap-3 px-6 py-3 text-[var(--color-paper)] shrink-0">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
            {section.tocIndex != null ? `§${section.tocIndex} · ` : ''}Plot images
          </div>
          <h2 className="font-display text-[16px] font-bold truncate">
            {sectionLabel(section)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-[3px] hover:bg-white/10 transition-colors"
        >
          <Icon.X size={16} />
        </button>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 relative min-h-0">
        {idx > 0 && (
          <button
            type="button"
            onClick={() => setIdx(idx - 1)}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 inline-flex items-center justify-center text-[var(--color-paper)] transition-colors z-10"
          >
            <Icon.Chevron size={18} className="rotate-180" />
          </button>
        )}
        {current.dataUrl ? (
          <img
            src={current.dataUrl}
            alt={current.caption}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--color-paper)]/70">
            <Icon.Image size={32} />
            <span className="font-mono uppercase tracking-[0.14em] text-[11px]">Rendering page {current.page}…</span>
          </div>
        )}
        {idx < plots.length - 1 && (
          <button
            type="button"
            onClick={() => setIdx(idx + 1)}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 inline-flex items-center justify-center text-[var(--color-paper)] transition-colors z-10"
          >
            <Icon.Chevron size={18} />
          </button>
        )}
      </div>
      <footer className="px-6 py-3 flex items-center justify-between gap-3 text-[var(--color-paper)]/80 shrink-0">
        <div className="font-mono text-[11px] tabular">
          Page {current.page} · {idx + 1} of {plots.length}
        </div>
        <div className="text-[11.5px] truncate max-w-[60%] text-right">{current.caption}</div>
      </footer>
    </div>,
    document.body,
  );
}

// Re-export for the top-level /plots surface so it can reuse the same shape.
export function collectAllPlots(imp: RiderImport) {
  return collectPlots(imp);
}

function PlotsPanel({ imp }: { imp: RiderImport }) {
  const sectionPlots = collectPlotsBySection(imp);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const totalPages = sectionPlots.reduce((n, sp) => n + sp.plots.length, 0);

  if (sectionPlots.length === 0) {
    return (
      <div className="rounded-[4px] border border-dashed border-[var(--color-rule)] py-16 text-center">
        <p className="text-[13px] text-[var(--color-ink-3)]">No stage plot or lightplot pages detected.</p>
        <p className="mt-1 text-[11.5px] text-[var(--color-ink-4)]">Plot images extracted from §7 Stage Plot and §8 Lightplot will appear here once the rider is imported.</p>
      </div>
    );
  }

  const active = lightboxIdx != null ? sectionPlots[lightboxIdx] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-bold leading-tight inline-flex items-baseline gap-1">
            Plots
            <SourceTag source="rider_plots" field="Stage plot & lightplot" />
          </h2>
          <p className="text-[12px] text-[var(--color-ink-3)] mt-0.5 leading-relaxed">
            One card per plot section. Click to flip through that section's pages as fullscreen images — no PDF scrolling, no other rider pages.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Chip tone="neutral" variant="outline">
            {sectionPlots.length} section{sectionPlots.length === 1 ? '' : 's'} · {totalPages} image{totalPages === 1 ? '' : 's'}
          </Chip>
          <Link
            to="/plots"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-ocean)] hover:underline"
            title="Open the full Plots surface"
          >
            Open Plots <Icon.Arrow size={11} />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sectionPlots.map(({ sectionKey, section, plots }, i) => (
          <SectionPlotCard
            key={sectionKey}
            section={section}
            plots={plots}
            onOpen={() => setLightboxIdx(i)}
          />
        ))}
      </div>
      <PlotImageLightbox
        open={active != null}
        onClose={() => setLightboxIdx(null)}
        section={active?.section ?? null}
        plots={active?.plots ?? []}
      />
    </div>
  );
}

function SectionPageLinks({ pages, sectionLabel }: { pages: number[]; sectionLabel: string }) {
  const { openPdf } = usePdfViewer();
  const pdfUrl = useActiveRiderPdfUrl();
  if (pages.length === 0) return null;
  return (
    <span>
      {'pp. '}
      {pages.map((p, i) => (
        <span key={p}>
          {i > 0 && ', '}
          {pdfUrl ? (
            <button
              type="button"
              onClick={() => openPdf({ url: pdfUrl, page: p, title: `${sectionLabel} — p.${p}` })}
              className="font-mono text-[var(--color-ocean)] underline decoration-dotted underline-offset-[3px] hover:decoration-solid hover:text-[var(--color-ink)] transition-colors"
            >
              {p}
            </button>
          ) : (
            <span className="font-mono text-[var(--color-ink-3)]">{p}</span>
          )}
        </span>
      ))}
      {' · '}
    </span>
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

  const label = sectionLabel(section);
  return (
    <>
      <SectionCard
        title={
          <span className="inline-flex items-baseline gap-2">
            {section.tocIndex != null && (
              <span className="font-mono text-[12px] text-[var(--color-ink-4)] tabular">§{section.tocIndex}</span>
            )}
            <span>{label}</span>
          </span>
        }
        eyebrow={
          <span className="inline-flex items-baseline">
            <SectionPageLinks pages={section.pages} sectionLabel={label} />
            {(section.language ?? sourceLang).toUpperCase()}
          </span>
        }
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
        ) : (
          <FreeTextReview
            es={freeText}
            pageTexts={section.pageTexts}
            disabled={approved}
            onChangeEs={(v) => editOrPropose({ freeText: v })}
          />
        )}
      </SectionCard>
    </>
  );
}

// =========================================================
// Per-section review components
// =========================================================

// Inline-edit primitives (EditableText / EditableSelect) now live in
// components/ui/EditableText.tsx — shared with the day-sheet schedule editor.

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

function FreeTextReview({
  es,
  pageTexts,
  onChangeEs,
  disabled,
}: {
  es?: string;
  pageTexts?: { page: number; text: string }[];
  onChangeEs: (v: string) => void;
  disabled: boolean;
}) {
  const taClass = cn(
    'w-full text-[13px] leading-[1.55] bg-transparent border-l-2 border-[var(--color-rule)] pl-3 py-1 rounded-r-[2px] outline-none resize-y',
    !disabled && 'hover:bg-[var(--color-paper-2)]/40 focus:bg-[var(--color-card)] focus:border-[var(--color-ocean)]',
  );

  const multiPage = (pageTexts?.length ?? 0) > 1;
  return (
    <div>
      <div className="eyebrow mb-1.5">Extracted text{multiPage && ' (joined)'}</div>
      <textarea
        value={es ?? ''}
        disabled={disabled}
        rows={multiPage ? 12 : 6}
        placeholder="Input Here"
        onChange={(e) => onChangeEs(e.target.value)}
        className={cn(taClass, 'text-[var(--color-ink-2)]')}
      />
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

// Scratch-mode upload zone, shown when no rider has been imported yet (or on re-upload).
function ScratchRiderUpload({ onDone }: { onDone?: () => void }) {
  const { addRiderImportToScratch } = useApp();
  const [note, setNote] = useState<UploadNote | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    setIsParsing(true);
    try {
      const parsed = await parseRiderPdf(file);
      if (!parsed.sections.length) throw new Error('Parser returned no sections.');
      // Persist the raw bytes so a refresh can rehydrate the Blob URL — the
      // parser already detached its copy into the worker, so re-read from the
      // File (multiple reads are allowed).
      await saveRiderPdf(parsed.id, await file.arrayBuffer());
      addRiderImportToScratch(parsed, buildScratchRiderPersonnel());
      onDone?.();
    } catch (err) {
      console.error('[rider parse] failed:', err);
      const fixture = matchFixture(file.name);
      const msg = err instanceof Error ? err.message : String(err);
      if (fixture?.kind === 'rider') {
        const fixtureImport = buildScratchRiderImport();
        // Fetch the canonical fixture PDF and stash it under the fixture
        // import's id, so the embedded viewer + plot links work even on the
        // fallback path. The warning note tells the user they're seeing fixture
        // data.
        let blobUrl: string | undefined;
        try {
          const resp = await fetch(RIDER_PDF_PATH);
          if (resp.ok) {
            const bytes = await resp.arrayBuffer();
            await saveRiderPdf(fixtureImport.id, bytes);
            blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          }
        } catch (fetchErr) {
          console.warn('[rider parse] fixture PDF fetch failed:', fetchErr);
        }
        const withBlob: RiderImport = blobUrl ? { ...fixtureImport, pdfObjectUrl: blobUrl } : fixtureImport;
        const hydrated = await hydrateRiderPlotImages(withBlob);
        addRiderImportToScratch(hydrated, buildScratchRiderPersonnel());
        setNote({
          tone: 'warning',
          title: 'Live parse failed — loaded sample data instead',
          detail: `Couldn't parse "${file.name}": ${msg}. Falling back to the canonical Spanish fixture. Check the browser console for the full stack.`,
        });
        onDone?.();
      } else {
        setNote({
          tone: 'warning',
          title: "Couldn't parse this rider",
          detail: `Parser error on "${file.name}": ${msg}. Check the browser console for the full stack — the rider may use an unusual table-of-contents layout the parser doesn't yet recognize.`,
        });
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
        hint={isParsing
          ? 'Extracting sections — this takes a few seconds.'
          : 'Any rider PDF works — the parser reads the table of contents and pulls out sections, band roster, PM contact, and party size. Spanish or English.'}
        icon={<Icon.Sparkle size={22} />}
        tourAnchor="rider-dropzone"
      />
      {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
    </div>
  );
}
