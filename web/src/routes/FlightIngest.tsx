import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { useTour } from '@/components/tour/TourProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { MockBadge } from '@/components/provenance/MockBadge';
import { MockTag } from '@/components/provenance/MockTag';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { usePdfViewer } from '@/components/PdfViewer';
import { FileDropZone } from '@/components/ingest/FileDropZone';
import { UploadResultNote } from '@/components/ingest/UploadResultNote';
import type { UploadNote } from '@/components/ingest/UploadResultNote';
import { CancelImportButton } from '@/components/ingest/CancelImportButton';
import { ResolveUnmatchedModal } from '@/components/ingest/ResolveUnmatchedModal';
import { LastUpdated } from '@/components/LastUpdated';
import { diffFlightImports, diffIsEmpty } from '@/lib/flightImportDiff';
import { matchFixture, fixturesOfKind, nonMatchNote } from '@/lib/fixtureMatcher';
import { parseRouteCsv } from '@/lib/routeCsv';
import { buildFlightImportsFromGrid } from '@/lib/travelGridCsv';
import { buildScratchFlightImport } from '@/data/flightFixture';
import { buildScratchHotelImport } from '@/data/hotelFixture';
import { parseFlightPdf, parseHotelPdf } from '@/lib/pdfParser';
import { dayTypeLabel, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { FlightImport, DayType } from '@/types';

type Note = UploadNote | null;

/**
 * "Import route & travel" — the combined ingest page. The route CSV lays down
 * the tour skeleton (days, venues, show-day schedule); flight PDFs then attach
 * travel to those days. Two collapsible sections keep it from overwhelming.
 */
export function FlightIngest() {
  const { tour } = useApp();
  const { step } = useTour();
  const routeLoaded = tour.days.length > 0;
  const activeStepId = step?.id;

  return (
    // pb-[40vh] gives the walkthrough room to scroll a bottom-of-page target
    // (the hotel dropzone) into the upper third of the viewport so the coach-
    // mark bubble doesn't overlap it when stepping from Flights → Hotels.
    <div className="pb-[40vh]">
      <PageHeader
        eyebrow="Import route & travel"
        title="Route &amp; travel import"
        description="First bring in the tour route, then the flights that move the party between cities."
        meta={<MockBadge source="flight_import" />}
      />

      <div className="space-y-4">
        <CollapsibleSection
          title="Tour route &amp; schedule"
          defaultOpen={!routeLoaded || activeStepId === 'route'}
          badge={
            routeLoaded ? (
              <Chip tone="success" size="sm" variant="outline">
                ✓ {tour.days.length} days · calendar &amp; schedule
              </Chip>
            ) : (
              <Chip tone="neutral" size="sm" variant="outline">Not imported</Chip>
            )
          }
        >
          <RouteImportSection />
        </CollapsibleSection>

        <CollapsibleSection
          title="Flights &amp; travel"
          defaultOpen={
            (routeLoaded && tour.hotels.length === 0) ||
            activeStepId === 'flight' ||
            activeStepId === 'flight-approve'
          }
          badge={(() => {
            const pending = tour.flightImports.filter((fi) => fi.status === 'review').length;
            const approved = tour.flightImports.filter((fi) => fi.status === 'imported').length;
            if (pending > 0) return <Chip tone="rehearsal" size="sm" variant="outline">{pending} pending review</Chip>;
            if (approved > 0) return <Chip tone="success" size="sm" variant="outline">✓ {approved} approved · travel records</Chip>;
            return <Chip tone="neutral" size="sm" variant="outline">No imports yet</Chip>;
          })()}
        >
          <FlightImportSection />
        </CollapsibleSection>

        <CollapsibleSection
          title="Hotels &amp; rooming"
          defaultOpen={
            (tour.hotels.length === 0 && tour.travel.length > 0) ||
            activeStepId === 'hotel'
          }
          badge={
            tour.hotels.length > 0 ? (
              <Chip tone="success" size="sm" variant="outline">
                ✓ {tour.hotels.length} hotel{tour.hotels.length === 1 ? '' : 's'} · day sheets &amp; tasks
              </Chip>
            ) : (
              <Chip tone="neutral" size="sm" variant="outline">Not imported</Chip>
            )
          }
        >
          <HotelImportSection />
        </CollapsibleSection>
      </div>

      <DataSourcesPanel
        sourceKeys={['route_import', 'flight_import', 'travel', 'tour_person']}
        intro="The route CSV builds the tour calendar and a schedule skeleton; flight PDFs are reviewed, then approved into Travel records."
      />
    </div>
  );
}

// ---- Route section ---------------------------------------------------------

function RouteImportSection() {
  const { tour, applyRouteToScratch } = useApp();
  const [note, setNote] = useState<Note>(null);
  const routeFixture = fixturesOfKind('route')[0];

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const fixture = matchFixture(file.name);
    if (fixture?.kind === 'route') {
      const parsed = parseRouteCsv(await file.text());
      if (parsed.days.length === 0) {
        setNote({
          tone: 'warning',
          title: 'No rows found',
          detail: `Couldn't read any day rows from "${file.name}". Check the CSV header.`,
        });
        return;
      }
      applyRouteToScratch(parsed, file.name);
      setNote({
        tone: 'success',
        title: `Imported ${parsed.days.length} days across ${parsed.legs.length} leg(s)`,
        detail: 'Every day now carries a mock schedule skeleton shaped to its type.',
      });
    } else {
      setNote(nonMatchNote(file, fixture, 'a CSV', routeFixture.filename));
    }
  };

  // Once the route is imported, show a read-only route summary.
  if (tour.days.length > 0) {
    return <RouteSummary />;
  }

  return (
    <div className="max-w-2xl">
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Upload the booking agent's routing spreadsheet. It builds a day for every
        date, sets each day's type, and seeds a schedule skeleton for every day.
      </p>
      <FileDropZone
        accept=".csv"
        onFiles={handleFiles}
        title="Drop the tour-route CSV"
        hint={`Upload "${routeFixture.filename}" — ${routeFixture.extracts}`}
        icon={<Icon.Calendar size={22} />}
        tourAnchor="route-dropzone"
      />
      {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
    </div>
  );
}

function RouteSummary() {
  const { tour, applyRouteToScratch } = useApp();
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const routeFixture = fixturesOfKind('route')[0];
  if (tour.days.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-ink-3)]">No route loaded yet.</p>
    );
  }
  const counts = tour.days.reduce<Record<string, number>>((acc, d) => {
    acc[d.dayType] = (acc[d.dayType] ?? 0) + 1;
    return acc;
  }, {});
  const wasUpdated = (tour.routeImport?.updates ?? 0) > 0;

  const handleReupload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const fixture = matchFixture(file.name);
    if (fixture?.kind === 'route') {
      const parsed = parseRouteCsv(await file.text());
      if (parsed.days.length === 0) {
        setNote({ tone: 'warning', title: 'No rows found', detail: `Couldn't read any day rows from "${file.name}".` });
        return;
      }
      applyRouteToScratch(parsed, file.name);
      setReuploadOpen(false);
      setNote({
        tone: 'success',
        title: 'Route updated',
        detail: `${parsed.days.length} days reloaded from "${file.name}".`,
      });
    } else {
      setNote(nonMatchNote(file, fixture, 'a CSV', routeFixture.filename));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {tour.routeImport?.filename ? (
            <Chip tone="travel" size="sm">
              <Icon.Document size={10} /> {tour.routeImport.filename}
            </Chip>
          ) : null}
          <span className="text-[13px] font-semibold text-[var(--color-ink)]">
            {tour.days.length} days · {tour.legs.length} leg
            {tour.legs.length === 1 ? '' : 's'}
          </span>
          <MockTag source="route_import" field="Tour route" />
        </div>
        <Button
          size="sm"
          variant="outline"
          leading={<Icon.Plus size={12} />}
          onClick={() => setReuploadOpen((v) => !v)}
        >
          {reuploadOpen ? 'Close' : 'Re-upload'}
        </Button>
      </div>
      {tour.routeImport && (
        <LastUpdated
          stamp={tour.routeImport}
          label={wasUpdated ? 'Updated' : 'Imported'}
          className="mb-2"
        />
      )}
      {reuploadOpen && (
        <div className="mb-3">
          <FileDropZone
            accept=".csv"
            onFiles={handleReupload}
            title="Drop a corrected route CSV"
            hint="The new file replaces the current route. Day-level edits, locks, and overlays are preserved where dates still match."
            icon={<Icon.Calendar size={22} />}
            tourAnchor="route-reupload-dropzone"
          />
          {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(counts).map(([type, n]) => (
          <Chip key={type} tone={type as DayType} size="sm">
            {n} {dayTypeLabel(type as DayType)}
          </Chip>
        ))}
      </div>
      <RouteHistory />
    </div>
  );
}

function RouteHistory() {
  const { tour } = useApp();
  const history = tour.routeImportHistory ?? [];
  if (history.length === 0) return null;
  return (
    <div className="mt-3">
      <CollapsibleSection
        eyebrow="Upload history"
        title={`Route history (${history.length} previous)`}
        defaultOpen={false}
      >
        <ul className="space-y-1.5 text-[11.5px] text-[var(--color-ink-3)]">
          {[...history].reverse().map((stamp, i) => (
            <li key={i} className="flex items-center gap-2">
              {stamp.filename && <span className="font-mono text-[var(--color-ink-2)]">{stamp.filename}</span>}
              <span>{stamp.at.replace('T', ' ')} by {stamp.by}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </div>
  );
}

// ---- Flight section --------------------------------------------------------

/**
 * Two imports describe the same flight when they share `(airline, flightNumber, departDate)`.
 * This can happen when the agent's grid AND a per-flight PDF both land for the same leg.
 * Returns: map from importId → the *earlier* import that already claimed the same identity.
 * (The first uploader wins; subsequent uploads are flagged as duplicates.)
 */
function findFlightDuplicates(imports: FlightImport[]): Map<string, FlightImport> {
  const seen = new Map<string, FlightImport>();
  const dups = new Map<string, FlightImport>();
  // Process in upload order so the first one becomes the canonical record.
  const ordered = [...imports].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  for (const imp of ordered) {
    for (const pf of imp.parsedFlights) {
      const key = `${pf.airline}|${pf.flightNumber}|${pf.departureTime.slice(0, 10)}`;
      const existing = seen.get(key);
      if (existing && existing.id !== imp.id) {
        dups.set(imp.id, existing);
      } else {
        seen.set(key, imp);
      }
    }
  }
  return dups;
}

function FlightImportSection() {
  const { tour, addFlightImportToScratch } = useApp();
  const imports = tour.flightImports;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const flightFixtures = fixturesOfKind('flight');
  const gridFixture = fixturesOfKind('travel_grid')[0];
  const duplicates = findFlightDuplicates(imports);

  const selected =
    imports.find((i) => i.id === selectedId) ??
    imports.find((i) => i.status === 'review') ??
    imports[0];

  const handleGrid = async (files: File[]) => {
    let imported = 0;
    let lastNote: Note = null;
    for (const file of files) {
      const fixture = matchFixture(file.name);
      if (fixture?.kind === 'travel_grid') {
        const text = await file.text();
        const newImports = buildFlightImportsFromGrid(text, file.name, tour.personnel);
        for (const fi of newImports) {
          addFlightImportToScratch(fi);
          setSelectedId(fi.id);
          imported++;
        }
      } else {
        lastNote = nonMatchNote(file, fixture, 'a travel-grid CSV', gridFixture?.filename ?? '');
      }
    }
    if (imported > 0) {
      setNote({
        tone: 'success',
        title: `Parsed ${imported} flight${imported === 1 ? '' : 's'} from the grid`,
        detail: 'Review each leg below, then Approve & import to add Travel records.',
      });
    } else if (lastNote) {
      setNote(lastNote);
    }
  };

  const handlePdfs = async (files: File[]) => {
    let imported = 0;
    let lastNote: Note = null;
    for (const file of files) {
      try {
        const fi = await parseFlightPdf(file, tour.personnel);
        if (fi.status !== 'failed' && fi.parsedFlights.length > 0) {
          addFlightImportToScratch(fi);
          setSelectedId(fi.id);
          imported++;
          continue;
        }
      } catch { /* fall through to fixture */ }
      // Fallback: fixture match for the known demo PDFs.
      const fixture = matchFixture(file.name);
      if (fixture?.kind === 'flight') {
        const fi = buildScratchFlightImport(fixture.id, tour.personnel);
        if (fi) { addFlightImportToScratch(fi); setSelectedId(fi.id); imported++; }
      } else {
        lastNote = nonMatchNote(file, fixture, 'a flight PDF', flightFixtures[0]?.filename ?? '');
      }
    }
    if (imported > 0) {
      setNote({
        tone: 'success',
        title: `Parsed ${imported} flight import${imported === 1 ? '' : 's'}`,
        detail: 'Review the passenger matches, then Approve & import to add Travel records.',
      });
    } else if (lastNote) {
      setNote(lastNote);
    }
  };

  // Heads-up when the user lands on flights before importing the rider.
  // Without a rider, the roster is just the Tour Manager — so every other
  // passenger row lands as "unmatched" and the reviewer has to resolve each
  // one by hand. Stays visible while the rider is still missing — that's
  // exactly when a freshly imported batch of unmatched rows is most fixable
  // by going to import the rider first.
  const needsRiderHint =
    tour.riderImports.length === 0 && tour.personnel.length <= 1;

  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
        Two ways in: drop the travel agent’s <strong>grid</strong> (CSV — every passenger × leg
        in one file) or per-flight <strong>boarding pass / e-ticket</strong> PDFs. Both feed the
        same review queue.
      </p>
      {needsRiderHint && (
        <div className="mb-3 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]/70 px-3 py-2 text-[12px] text-[var(--color-ink-2)] flex items-start gap-2">
          <Icon.Info size={12} className="text-[var(--color-ink-3)] shrink-0 mt-[3px]" />
          <span>
            <strong>Tip — import the rider first.</strong> Passenger names are matched against
            your tour roster; right now the roster only has you. Drop the rider on{' '}
            <Link to="/ingest/riders" className="underline font-semibold text-[var(--color-ink)]">
              Rider ingest
            </Link>{' '}
            so the band &amp; crew land on the roster before you import flights.
          </span>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <FileDropZone
          accept=".csv"
          multiple
          onFiles={handleGrid}
          title="Travel-agent grid (CSV)"
          hint={
            gridFixture
              ? `Bulk import — upload "${gridFixture.filename}".`
              : 'Bulk import — upload a travel-grid CSV.'
          }
          icon={<Icon.Sparkle size={22} />}
          tourAnchor="travel-grid-dropzone"
        />
        <FileDropZone
          accept=".pdf"
          multiple
          onFiles={handlePdfs}
          title="Flight confirmations (PDF)"
          hint={
            flightFixtures.length > 0
              ? `Per-flight — upload "${flightFixtures.map((f) => f.filename).join('" or "')}".`
              : 'Per-flight — upload a confirmation PDF.'
          }
          icon={<Icon.Plane size={22} />}
          tourAnchor="flight-dropzone"
        />
      </div>
      {note && <div className="mb-5"><UploadResultNote {...note} onDismiss={() => setNote(null)} /></div>}

      {imports.length === 0 ? (
        <EmptyState
          title="No flights imported yet"
          hint="Upload a flight PDF above to start the review."
        />
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-5">
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
              <div className="eyebrow">Recent imports</div>
              <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
                {imports.length} in queue ·{' '}
                {imports.filter((i) => i.status === 'review').length} need review
              </div>
            </div>
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {imports.map((imp) => {
                const active = imp.id === selected?.id;
                const needsReview = imp.status === 'review';
                const duplicate = duplicates.get(imp.id);
                return (
                  <li key={imp.id}>
                    <button
                      onClick={() => setSelectedId(imp.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-[var(--color-paper)]/60 transition-colors',
                        active &&
                          'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusChip status={imp.status} inverted={active} />
                        {needsReview && imp.unmatchedNames.length > 0 && (
                          <Chip tone="rehearsal" size="sm">
                            {imp.unmatchedNames.length} unmatched
                          </Chip>
                        )}
                        {duplicate && (
                          <Chip tone="critical" size="sm" variant="soft">
                            Duplicate
                          </Chip>
                        )}
                      </div>
                      <div
                        className={cn(
                          'text-[12px] font-mono truncate',
                          active ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink-2)]',
                        )}
                      >
                        {imp.filename}
                      </div>
                      <div
                        className={cn(
                          'text-[10.5px] font-mono mt-1 tabular flex flex-wrap gap-x-2',
                          active
                            ? 'text-[var(--color-paper)] opacity-75'
                            : 'text-[var(--color-ink-4)]',
                        )}
                      >
                        <span>
                          {(imp.updates ?? 0) > 0 ? 'updated' : 'imported'}{' '}
                          {imp.uploadedAt.replace('T', ' ')}
                        </span>
                        {imp.uploadedBy && <span>· by {imp.uploadedBy}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            <FlightReview imp={selected} duplicateOf={duplicates.get(selected.id)} />
          ) : (
            <EmptyState title="Select an import" />
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status, inverted }: { status: FlightImport['status']; inverted?: boolean }) {
  const map = {
    queued: { tone: 'neutral' as const, label: 'Queued' },
    parsing: { tone: 'travel' as const, label: 'Parsing' },
    review: { tone: 'rehearsal' as const, label: 'Review' },
    imported: { tone: 'success' as const, label: 'Imported' },
    failed: { tone: 'critical' as const, label: 'Failed' },
  };
  const m = map[status];
  return (
    <Chip tone={m.tone} variant={inverted ? 'outline' : 'soft'} size="sm">
      {m.label}
    </Chip>
  );
}

function FlightReview({ imp, duplicateOf }: { imp: FlightImport; duplicateOf?: FlightImport }) {
  const { openPdf } = usePdfViewer();
  const {
    commitFlightImportToScratch,
    discardFlightImport,
    replaceFlightImport,
    mergeFlightImport,
    editFlightImportPassenger,
    removeFlightImportPassenger,
  } = useApp();
  const [resolveOpen, setResolveOpen] = useState(false);
  // Focus a specific unmatched name when the modal opens — null = show all.
  const [resolveFocusName, setResolveFocusName] = useState<string | null>(null);
  // Per-row inline edit state. Key = passenger index; value = draft name.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const openResolveFor = (name: string | null) => {
    setResolveFocusName(name);
    setResolveOpen(true);
  };
  const f = imp.parsedFlights[0];
  if (!f) return <EmptyState title="No flights parsed" />;

  const diff = duplicateOf ? diffFlightImports(duplicateOf, imp) : null;
  // Purely additive: new passengers only, no seat/metadata changes, existing already committed.
  const isAdditiveOnly =
    diff !== null &&
    duplicateOf?.status === 'imported' &&
    diff.added.length > 0 &&
    diff.changed.length === 0 &&
    diff.removed.length === 0 &&
    !diff.metadataChanged;

  return (
    <div className="space-y-5">
      {duplicateOf && diff && (
        <div className="rounded-[3px] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-3 text-[12.5px] leading-relaxed">
          <div className="flex items-center gap-2 font-semibold text-[var(--color-ink)]">
            <Icon.Alert size={14} className="text-[var(--color-accent)]" />
            Duplicate of {f.flightNumber} on {f.departureTime.slice(0, 10)}
          </div>
          <div className="mt-1 text-[var(--color-ink-3)]">
            This same flight was already imported from{' '}
            <span className="font-mono">{duplicateOf.filename}</span>. Approving both
            will create two Travel records for the same leg.
          </div>
          {!diffIsEmpty(diff) ? (
            <div className="mt-2.5 text-[12px] text-[var(--color-ink-2)]">
              <div className="font-semibold mb-1">Changes vs the existing import:</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {diff.changed.map((c) => (
                  <li key={`c-${c.name}`}>
                    <span className="font-semibold">{c.name}</span>: seat{' '}
                    <span className="font-mono">{c.fromSeat ?? '—'}</span> →{' '}
                    <span className="font-mono">{c.toSeat ?? '—'}</span>
                  </li>
                ))}
                {diff.added.map((p) => (
                  <li key={`a-${p.name}`}>
                    <span className="font-semibold text-[var(--color-moss)]">+ {p.name}</span>
                    {p.seat ? <span className="text-[var(--color-ink-3)]"> (seat {p.seat})</span> : null}
                  </li>
                ))}
                {diff.removed.map((p) => (
                  <li key={`r-${p.name}`}>
                    <span className="font-semibold text-[var(--color-accent)]">− {p.name}</span>
                    {p.seat ? <span className="text-[var(--color-ink-3)]"> (was seat {p.seat})</span> : null}
                  </li>
                ))}
                {diff.metadataChanged && <li>Flight metadata (time / PNR / airports) differs.</li>}
              </ul>
              {isAdditiveOnly && (
                <p className="mt-2 text-[11.5px] text-[#3a6b3a] font-medium">
                  Only new passengers — merging will update the approved Travel record directly. No re-approval needed.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 text-[11.5px] text-[var(--color-ink-3)] italic">
              No data differences — the two imports describe the same flight identically.
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              leading={<Icon.Check size={12} />}
              onClick={() => replaceFlightImport(duplicateOf.id, imp.id)}
            >
              Replace existing
            </Button>
            {!diffIsEmpty(diff) && (
              <Button
                size="sm"
                variant="outline"
                leading={isAdditiveOnly ? <Icon.Plus size={12} /> : undefined}
                onClick={() => mergeFlightImport(duplicateOf.id, imp.id)}
              >
                {isAdditiveOnly
                  ? `Add ${diff.added.length} passenger${diff.added.length === 1 ? '' : 's'} to Travel`
                  : 'Merge into existing'}
              </Button>
            )}
          </div>
        </div>
      )}
      <Card padded={false} className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-rule-soft)] flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Side-by-side review</div>
            <button
              type="button"
              onClick={() => openPdf({ url: '/' + imp.filename, title: imp.filename })}
              title="View the flight confirmation PDF"
              className="mt-1 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Chip tone="travel">
                <Icon.Document size={10} /> {imp.filename}
              </Chip>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={imp.status} />
            {imp.status === 'review' && imp.unmatchedNames.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                leading={<Icon.Alert size={12} />}
                onClick={() => openResolveFor(null)}
              >
                Resolve {imp.unmatchedNames.length} unmatched
              </Button>
            )}
            {imp.status === 'review' && (
              <CancelImportButton
                label="this flight import"
                detail={`Discards "${imp.filename}" before it's added to Travel. The roster and other imports are untouched.`}
                onConfirm={(reason) => discardFlightImport(imp.id, reason)}
                triggerLabel="Discard"
              />
            )}
            {imp.status === 'review' && (
              <span data-tour="flight-approve" className="inline-flex">
                <Button
                  size="sm"
                  variant="primary"
                  leading={<Icon.Check size={12} />}
                  onClick={() => commitFlightImportToScratch(imp.id)}
                >
                  Approve &amp; import
                </Button>
              </span>
            )}
          </div>
        </div>
        <ResolveUnmatchedModal
          open={resolveOpen}
          onClose={() => { setResolveOpen(false); setResolveFocusName(null); }}
          imp={imp}
          focusName={resolveFocusName ?? undefined}
        />

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="border-r border-[var(--color-rule-soft)] p-5 min-h-[400px] bg-[var(--color-paper-2)]/30">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-2">
              Source PDF
            </div>
            <div className="bg-[var(--color-card)] border border-[var(--color-rule)] rounded-[3px] p-5 font-mono text-[11.5px] leading-[1.6] text-[var(--color-ink-2)] shadow-sm">
              <div className="text-center font-bold uppercase tracking-[0.10em] mb-3 text-[var(--color-ink)]">
                {f.airline}
              </div>
              <div className="text-center text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mb-4">
                Electronic ticket — boarding pass
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">From</div>
                  <div className="font-bold text-[20px] mt-0.5">{f.departureAirport}</div>
                </div>
                <div className="text-[var(--color-ink-3)] self-center">→</div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">To</div>
                  <div className="font-bold text-[20px] mt-0.5">{f.arrivalAirport}</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-dashed border-[var(--color-rule)] grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">Flight</div>
                  <div className="font-semibold mt-0.5">{f.flightNumber}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">PNR</div>
                  <div className="font-semibold mt-0.5">{f.recordLocator ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.10em] text-[var(--color-ink-3)]">Depart</div>
                  <div className="font-semibold mt-0.5">{f.departureTime.slice(11, 16)}</div>
                </div>
              </div>
              <div className="mt-4 text-[10px] uppercase tracking-[0.10em] text-[var(--color-ink-3)] mb-1">
                Passengers
              </div>
              <ul className="space-y-0.5">
                {f.passengers.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="tabular">{p.seat}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-center text-[9px] text-[var(--color-ink-4)] uppercase tracking-[0.10em]">
                — Mocked PDF preview · real PDF would render here —
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--color-ink-3)] mb-2">
              Extracted structured data
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Airline" value={f.airline} />
              <Field label="Flight #" value={f.flightNumber} />
              <Field label="From" value={f.departureAirport} mono />
              <Field label="To" value={f.arrivalAirport} mono />
              <Field label="Depart" value={f.departureTime.replace('T', ' ')} mono />
              <Field label="Arrive" value={f.arrivalTime.replace('T', ' ')} mono />
              <Field label="PNR" value={f.recordLocator ?? '—'} mono />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="eyebrow">Passengers · {f.passengers.length}</div>
                {imp.unmatchedNames.length > 0 && (
                  <Chip tone="rehearsal" size="sm">
                    {imp.unmatchedNames.length} unmatched
                  </Chip>
                )}
              </div>
              <ul className="border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden divide-y divide-[var(--color-rule-soft)]">
                {f.passengers.map((p, i) => {
                  const matched = !!p.matchedTourPersonId;
                  const editing = editingIndex === i;
                  const canEdit = imp.status === 'review';
                  const commitEdit = () => {
                    const next = editDraft.trim();
                    if (next && next !== p.name) {
                      // TODO: parsedFlights[0] is the only leg today (grid CSV
                      // produces one import per leg; PDF parser produces one
                      // ParsedFlight per file). When a multi-leg PDF lands,
                      // thread the actual legIndex through.
                      editFlightImportPassenger(imp.id, 0, i, { name: next });
                    }
                    setEditingIndex(null);
                  };
                  return (
                    <li
                      // Name keys survive remove (no stale-index edit state)
                      // and a rename flips the key, remounting the input cleanly.
                      key={`${p.name}-${i}`}
                      className={cn(
                        'flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] group',
                        !matched && !editing && 'bg-[rgba(160,122,46,0.06)]',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {matched ? (
                          <Icon.Check size={12} className="text-[var(--color-day-promo)] shrink-0" />
                        ) : (
                          <Icon.Alert
                            size={12}
                            className="text-[var(--color-day-rehearsal)] shrink-0"
                          />
                        )}
                        {editing ? (
                          <input
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit();
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                            className="flex-1 min-w-0 text-[12.5px] border border-[var(--color-ink-3)] rounded-[3px] px-2 py-0.5 bg-[var(--color-card)] focus:outline-none"
                          />
                        ) : (
                          <span className="truncate">{p.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] tabular text-[var(--color-ink-3)]">
                          {p.seat ?? '—'}
                        </span>
                        {matched ? (
                          <Chip tone="success" size="sm" variant="outline">
                            Matched
                          </Chip>
                        ) : (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => openResolveFor(p.name)}
                            className={cn(
                              'text-[11px] font-semibold',
                              canEdit
                                ? 'text-[var(--color-accent)] underline cursor-pointer hover:opacity-80'
                                : 'text-[var(--color-ink-4)]',
                            )}
                          >
                            {canEdit ? 'Resolve' : 'Unmatched'}
                          </button>
                        )}
                        {canEdit && !editing && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              title="Edit name"
                              onClick={() => { setEditingIndex(i); setEditDraft(p.name); }}
                              className="p-1 rounded-[3px] hover:bg-[var(--color-paper)] cursor-pointer text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
                            >
                              <Icon.Edit size={11} />
                            </button>
                            <button
                              type="button"
                              title="Remove passenger from this import"
                              onClick={() => {
                                if (confirm(`Remove "${p.name}" from this flight import?\n\nUse this for parser junk (footer text picked up as a passenger). The Travel record won't include them.`)) {
                                  // legIndex 0 — see editFlightImportPassenger TODO above.
                                  removeFlightImportPassenger(imp.id, 0, i);
                                }
                              }}
                              className="p-1 rounded-[3px] hover:bg-[var(--color-accent)]/10 cursor-pointer text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
                            >
                              <Icon.X size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {imp.unmatchedNames.length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--color-ink-3)] leading-snug">
                  Unmatched passengers aren't on the roster yet — fix a typo in
                  the name (✏️), remove a parser-junk row (✕), or click{' '}
                  <strong>Resolve</strong> to assign / add / skip. Unresolved rows
                  are skipped when this import is approved into Travel.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-[var(--color-rule-soft)] rounded-[3px] px-3 py-2 bg-[var(--color-paper)]/40">
      <div className="eyebrow">{label}</div>
      <div className={cn('mt-0.5 text-[13px] font-semibold text-[var(--color-ink)]', mono && 'font-mono tabular')}>
        {value}
      </div>
    </div>
  );
}

// ---- Hotel section ---------------------------------------------------------

// Import one hotel PDF — parser-first, with fixture fallback by filename.
// Returns true if the import succeeded so the caller can aggregate counts
// across a multi-file drop.
async function importHotelFile(
  file: File,
  tour: ReturnType<typeof useApp>['tour'],
  addHotelImportToScratch: ReturnType<typeof useApp>['addHotelImportToScratch'],
): Promise<{ ok: true; hotels: number } | { ok: false; reason: 'unknown' | 'error' }> {
  try {
    const { hotels, tasks } = await parseHotelPdf(file, tour.personnel, tour.days);
    if (hotels.length > 0) {
      addHotelImportToScratch(hotels, tasks, file.name);
      return { ok: true, hotels: hotels.length };
    }
  } catch { /* fall through to fixture */ }
  const fixture = matchFixture(file.name);
  if (fixture?.kind === 'hotel') {
    const built = buildScratchHotelImport(fixture.id, tour.personnel);
    if (built) {
      addHotelImportToScratch(built.hotels, built.tasks, file.name);
      return { ok: true, hotels: built.hotels.length };
    }
  }
  return { ok: false, reason: fixture ? 'unknown' : 'unknown' };
}

function HotelImportSection() {
  const { tour, addHotelImportToScratch } = useApp();
  const [note, setNote] = useState<Note>(null);
  const hotelFixtures = fixturesOfKind('hotel');

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    let imported = 0;
    let totalHotels = 0;
    const failed: string[] = [];
    for (const file of files) {
      const res = await importHotelFile(file, tour, addHotelImportToScratch);
      if (res.ok) { imported += 1; totalHotels += res.hotels; }
      else { failed.push(file.name); }
    }
    if (imported === 0) {
      const first = files[0];
      const fixture = matchFixture(first.name);
      setNote(nonMatchNote(first, fixture, 'a hotel confirmation PDF', hotelFixtures[0]?.filename ?? ''));
      return;
    }
    setNote({
      tone: failed.length ? 'warning' : 'success',
      title: `Imported ${totalHotels} hotel block${totalHotels === 1 ? '' : 's'}`,
      detail: failed.length
        ? `${imported} of ${files.length} confirmations imported. Couldn't read: ${failed.join(', ')}.`
        : 'Rooming lists matched to your roster; hotel-advance tasks added to the calendar.',
    });
  };

  if (tour.hotels.length > 0) {
    return <HotelSummary />;
  }

  const hint = hotelFixtures.length > 0
    ? `One PDF per hotel — drop all of them at once. Samples: ${hotelFixtures.map((f) => `"${f.filename}"`).join(' and ')}.`
    : 'One PDF per hotel — drop all of them at once.';

  return (
    <div className="max-w-2xl">
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Upload one booking confirmation per hotel. Each one adds its hotel to
        the check-in day, matches the rooming list to your roster, and creates
        the hotel-advance tasks. Drop multiple confirmations together.
      </p>
      <FileDropZone
        accept=".pdf"
        multiple
        onFiles={handleFiles}
        title="Drop hotel booking confirmation PDFs"
        hint={hint}
        icon={<Icon.Home size={22} />}
        tourAnchor="hotel-dropzone"
      />
      {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
    </div>
  );
}

function HotelSummary() {
  const { tour, getDayById, addHotelImportToScratch } = useApp();
  const { openPdf } = usePdfViewer();
  const hotelFixtures = fixturesOfKind('hotel');
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const wasUpdated = (tour.hotelImport?.updates ?? 0) > 0;

  const handleReupload = async (files: File[]) => {
    if (!files.length) return;
    let imported = 0;
    let totalHotels = 0;
    const failed: string[] = [];
    for (const file of files) {
      const res = await importHotelFile(file, tour, addHotelImportToScratch);
      if (res.ok) { imported += 1; totalHotels += res.hotels; }
      else { failed.push(file.name); }
    }
    if (imported === 0) {
      const first = files[0];
      const fixture = matchFixture(first.name);
      setNote(nonMatchNote(first, fixture, 'a hotel confirmation PDF', hotelFixtures[0]?.filename ?? ''));
      return;
    }
    setReuploadOpen(false);
    setNote({
      tone: failed.length ? 'warning' : 'success',
      title: 'Hotel blocks updated',
      detail: failed.length
        ? `${imported} of ${files.length} confirmations re-imported. Couldn't read: ${failed.join(', ')}.`
        : `${totalHotels} hotel${totalHotels === 1 ? '' : 's'} re-imported from ${imported} file${imported === 1 ? '' : 's'}.`,
    });
  };

  // The summary chip / preview uses the last uploaded filename — fall back to
  // the CDMX sample so existing tours that pre-date per-hotel splitting still
  // show a sensible label.
  const displayFilename = tour.hotelImport?.filename ?? hotelFixtures[0]?.filename;
  const previewFixture = hotelFixtures.find((f) => f.filename === displayFilename) ?? hotelFixtures[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {displayFilename && (
          <button
            type="button"
            onClick={() => previewFixture && openPdf({ url: '/' + previewFixture.filename, title: displayFilename })}
            title={previewFixture ? 'View the hotel confirmation PDF' : undefined}
            className={cn('hover:opacity-80 transition-opacity', previewFixture ? 'cursor-pointer' : 'cursor-default')}
          >
            <Chip tone="travel">
              <Icon.Document size={10} /> {displayFilename}
            </Chip>
          </button>
        )}
        <Button
          size="sm"
          variant="outline"
          leading={<Icon.Plus size={12} />}
          onClick={() => setReuploadOpen((v) => !v)}
        >
          {reuploadOpen ? 'Close' : 'Re-upload'}
        </Button>
      </div>
      {tour.hotelImport && (
        <LastUpdated stamp={tour.hotelImport} label={wasUpdated ? 'Updated' : 'Imported'} />
      )}
      {reuploadOpen && (
        <div>
          <FileDropZone
            accept=".pdf"
            multiple
            onFiles={handleReupload}
            title="Drop corrected hotel booking confirmations"
            hint="Each new PDF replaces (or adds) its hotel block + advance tasks. Drop multiple at once."
            icon={<Icon.Home size={22} />}
          />
          {note && <UploadResultNote {...note} onDismiss={() => setNote(null)} />}
        </div>
      )}
      <ul className="border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden divide-y divide-[var(--color-rule-soft)]">
        {tour.hotels.map((h) => {
          const day = getDayById(h.dayId);
          return (
            <li key={h.id} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[var(--color-ink)]">{h.name}</span>
                <Chip tone="neutral" size="sm" variant="outline">
                  {h.occupants.length} room{h.occupants.length === 1 ? '' : 's'}
                </Chip>
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">
                {h.address}
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                Check-in {day ? fmtDate(day.date, 'MMM d') : '—'} · {h.nights} night
                {h.nights === 1 ? '' : 's'}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11.5px] text-[var(--color-ink-3)] leading-snug">
        Hotels show on each day's Day Sheet and Day Detail. Hotel-advance tasks
        were added to the calendar.
      </p>
      <HotelHistory />
    </div>
  );
}

function HotelHistory() {
  const { tour } = useApp();
  const history = tour.hotelImportHistory ?? [];
  if (history.length === 0) return null;
  return (
    <CollapsibleSection
      eyebrow="Upload history"
      title={`Hotel history (${history.length} previous)`}
      defaultOpen={false}
    >
      <ul className="space-y-1.5 text-[11.5px] text-[var(--color-ink-3)]">
        {[...history].reverse().map((stamp, i) => (
          <li key={i} className="flex items-center gap-2">
            {stamp.filename && <span className="font-mono text-[var(--color-ink-2)]">{stamp.filename}</span>}
            <span>{stamp.at.replace('T', ' ')} by {stamp.by}</span>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}
