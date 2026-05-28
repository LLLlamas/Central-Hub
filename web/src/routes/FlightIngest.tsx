import { useState } from 'react';
import { useApp } from '@/state/AppState';
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
  const routeLoaded = tour.days.length > 0;

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
          eyebrow="Step 1"
          title="Tour route &amp; schedule"
          defaultOpen={!routeLoaded}
          badge={
            <Chip tone={routeLoaded ? 'success' : 'neutral'} size="sm" variant="outline">
              {routeLoaded ? `${tour.days.length} days` : 'Not imported'}
            </Chip>
          }
        >
          <RouteImportSection />
        </CollapsibleSection>

        <CollapsibleSection
          eyebrow="Step 2"
          title="Flights &amp; travel"
          defaultOpen={routeLoaded && tour.hotels.length === 0}
          badge={
            <Chip tone="neutral" size="sm" variant="outline">
              {tour.flightImports.length} import{tour.flightImports.length === 1 ? '' : 's'}
            </Chip>
          }
        >
          <FlightImportSection />
        </CollapsibleSection>

        <CollapsibleSection
          eyebrow="Step 3"
          title="Hotels &amp; rooming"
          defaultOpen={tour.hotels.length === 0 && tour.travel.length > 0}
          badge={
            <Chip tone={tour.hotels.length > 0 ? 'success' : 'neutral'} size="sm" variant="outline">
              {tour.hotels.length > 0
                ? `${tour.hotels.length} hotel${tour.hotels.length === 1 ? '' : 's'}`
                : 'Not imported'}
            </Chip>
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
      applyRouteToScratch(parsed);
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
      applyRouteToScratch(parsed);
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
        <div className="flex items-center gap-2">
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

  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--color-ink-3)] leading-relaxed">
        Two ways in: drop the travel agent’s <strong>grid</strong> (CSV — every passenger × leg
        in one file) or per-flight <strong>boarding pass / e-ticket</strong> PDFs. Both feed the
        same review queue.
      </p>
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
  const { commitFlightImportToScratch, discardFlightImport, replaceFlightImport, mergeFlightImport } = useApp();
  const [resolveOpen, setResolveOpen] = useState(false);
  const f = imp.parsedFlights[0];
  if (!f) return <EmptyState title="No flights parsed" />;

  const diff = duplicateOf ? diffFlightImports(duplicateOf, imp) : null;

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
                onClick={() => mergeFlightImport(duplicateOf.id, imp.id)}
              >
                Merge into existing
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
                onClick={() => setResolveOpen(true)}
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
        <ResolveUnmatchedModal open={resolveOpen} onClose={() => setResolveOpen(false)} imp={imp} />

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
                  return (
                    <li
                      key={i}
                      className={cn(
                        'flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]',
                        !matched && 'bg-[rgba(160,122,46,0.06)]',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {matched ? (
                          <Icon.Check size={12} className="text-[var(--color-day-promo)]" />
                        ) : (
                          <Icon.Alert size={12} className="text-[var(--color-day-rehearsal)]" />
                        )}
                        <span className="truncate">{p.name}</span>
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
                          <span className="text-[11px] font-semibold text-[var(--color-ink-4)]">
                            Unmatched
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {imp.unmatchedNames.length > 0 && (
                <p className="mt-2 text-[11px] text-[var(--color-ink-3)] leading-snug">
                  Unmatched passengers aren't on the roster yet — they're skipped
                  when this import is approved into Travel.
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

function HotelImportSection() {
  const { tour, addHotelImportToScratch } = useApp();
  const [note, setNote] = useState<Note>(null);
  const hotelFixture = fixturesOfKind('hotel')[0];

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const { hotels, tasks } = await parseHotelPdf(file, tour.personnel, tour.days);
      if (hotels.length > 0) {
        addHotelImportToScratch(hotels, tasks);
        setNote({
          tone: 'success',
          title: `Imported ${hotels.length} hotel block${hotels.length === 1 ? '' : 's'}`,
          detail: 'Rooming lists matched to your roster; hotel-advance tasks added to the calendar.',
        });
        return;
      }
    } catch { /* fall through to fixture */ }
    // Fallback: fixture match for the known demo hotel PDF.
    const fixture = matchFixture(file.name);
    if (fixture?.kind === 'hotel') {
      const { hotels, tasks } = buildScratchHotelImport(tour.personnel);
      addHotelImportToScratch(hotels, tasks);
      setNote({
        tone: 'success',
        title: `Imported ${hotels.length} hotel block${hotels.length === 1 ? '' : 's'}`,
        detail: 'Rooming lists matched to your roster; hotel-advance tasks added to the calendar.',
      });
    } else {
      setNote(nonMatchNote(file, fixture, 'a hotel confirmation PDF', hotelFixture?.filename ?? ''));
    }
  };

  if (tour.hotels.length > 0) {
    return <HotelSummary />;
  }

  return (
    <div className="max-w-2xl">
      <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3 leading-relaxed">
        Upload the hotel-block confirmation. It adds each hotel to its check-in
        day, matches the rooming list to your roster, and creates the
        hotel-advance tasks.
      </p>
      <FileDropZone
        accept=".pdf"
        onFiles={handleFiles}
        title="Drop the hotel-block confirmation PDF"
        hint={
          hotelFixture
            ? `Upload "${hotelFixture.filename}" — ${hotelFixture.extracts}`
            : 'Upload a hotel confirmation PDF.'
        }
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
  const hotelFixture = fixturesOfKind('hotel')[0];
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const wasUpdated = (tour.hotelImport?.updates ?? 0) > 0;

  const handleReupload = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const fixture = matchFixture(file.name);
    if (fixture?.kind === 'hotel') {
      const { hotels, tasks } = buildScratchHotelImport(tour.personnel);
      addHotelImportToScratch(hotels, tasks);
      setReuploadOpen(false);
      setNote({
        tone: 'success',
        title: 'Hotel block updated',
        detail: `${hotels.length} hotel${hotels.length === 1 ? '' : 's'} re-imported from "${file.name}".`,
      });
    } else {
      setNote(nonMatchNote(file, fixture, 'a hotel confirmation PDF', hotelFixture?.filename ?? ''));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hotelFixture && (
          <button
            type="button"
            onClick={() => openPdf({ url: '/' + hotelFixture.filename, title: hotelFixture.filename })}
            title="View the hotel confirmation PDF"
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            <Chip tone="travel">
              <Icon.Document size={10} /> {hotelFixture.filename}
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
            onFiles={handleReupload}
            title="Drop a corrected hotel-block confirmation"
            hint="The new file replaces the current hotel block + advance tasks."
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
    </div>
  );
}
