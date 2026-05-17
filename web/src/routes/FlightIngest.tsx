import { useState } from 'react';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionCard, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { MockBadge } from '@/components/provenance/MockBadge';
import { DataSourcesPanel } from '@/components/provenance/DataSourcesPanel';
import { cn } from '@/lib/cn';
import type { FlightImport } from '@/types';

export function FlightIngest() {
  const { tour } = useApp();
  const imports = tour.flightImports;
  const [selectedId, setSelectedId] = useState<string | null>(
    imports.find((i) => i.status === 'review')?.id ?? imports[0]?.id ?? null,
  );
  const selected = imports.find((i) => i.id === selectedId);

  return (
    <div>
      <PageHeader
        eyebrow="Import flights"
        title={
          <>
            Flight import
          </>
        }
        description="Review parsed flight confirmations, fix passenger matches, then import flights to the right tour day."
        actions={
          <Button variant="primary" leading={<Icon.Plus size={14} />}>
            Upload PDFs
          </Button>
        }
        meta={<MockBadge source="flight_import" />}
      />

      {/* Upload zone */}
      <div className="card border-dashed bg-[var(--color-paper-2)]/20 mb-6">
        <div className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-[3px] border-2 border-dashed border-[var(--color-rule)] flex items-center justify-center text-[var(--color-ink-3)]">
            <Icon.Plane size={24} />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-[var(--color-ink)]">
              Drop flight PDFs here
            </div>
            <div className="text-[12.5px] text-[var(--color-ink-3)] mt-0.5">
              Or click to select. Multiple files OK. Server stores in R2, sends base64 + structured-output prompt to Anthropic. Budget ~$0.05/PDF.
            </div>
          </div>
          <Button variant="outline" leading={<Icon.Sparkle size={13} />}>
            Try sample
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        {/* Imports list */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
            <div className="eyebrow">Recent imports</div>
            <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
              {imports.length} in queue · {imports.filter((i) => i.status === 'review').length} need review
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-rule-soft)]">
            {imports.map((imp) => {
              const active = imp.id === selectedId;
              const needsReview = imp.status === 'review';
              return (
                <li key={imp.id}>
                  <button
                    onClick={() => setSelectedId(imp.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-[var(--color-paper)]/60 transition-colors',
                      active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <StatusChip status={imp.status} inverted={active} />
                      {needsReview && (
                        <Chip tone="rehearsal" size="sm">
                          {imp.unmatchedNames.length} unmatched
                        </Chip>
                      )}
                    </div>
                    <div className={cn('text-[12px] font-mono truncate', active ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink-2)]')}>
                      {imp.filename}
                    </div>
                    <div className={cn('text-[10.5px] font-mono mt-1 tabular', active ? 'text-[var(--color-paper)] opacity-75' : 'text-[var(--color-ink-4)]')}>
                      {imp.uploadedAt.replace('T', ' ')}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {selected ? <FlightReview imp={selected} /> : <EmptyState title="Select an import" />}
      </div>

      <DataSourcesPanel
        sourceKeys={['flight_import', 'travel', 'tour_person']}
        intro="Flight imports are the simplest AI ingest because confirmation PDFs are highly structured. Pipeline: drop PDF → Claude extracts structured Flight → human reviews → matches names to TourPerson records → imports as Travel + passengers."
      />
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

function FlightReview({ imp }: { imp: FlightImport }) {
  const f = imp.parsedFlights[0];
  if (!f) return <EmptyState title="No flights parsed" />;

  return (
    <div className="space-y-5">
      {/* Two-pane review header */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-rule-soft)] flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Side-by-side review</div>
            <div className="text-[13.5px] font-semibold mt-0.5">{imp.filename}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={imp.status} />
            <Button size="sm" variant="outline" leading={<Icon.X size={12} />}>
              Discard
            </Button>
            {imp.status === 'review' && (
              <Button size="sm" variant="primary" leading={<Icon.Check size={12} />}>
                Approve & import
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: PDF preview placeholder */}
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

          {/* Right: extracted structured data */}
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
                          <button className="text-[11px] font-semibold text-[var(--color-accent)]">
                            Match…
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* JSON peek for developers */}
      <SectionCard title="Structured output" eyebrow="What Claude returns">
        <pre className="font-mono text-[11px] leading-[1.5] text-[var(--color-ink-2)] bg-[var(--color-paper-2)]/40 p-4 rounded-[3px] overflow-x-auto">
{JSON.stringify(
  {
    airline: f.airline,
    flight_number: f.flightNumber,
    departure_airport: f.departureAirport,
    arrival_airport: f.arrivalAirport,
    departure_time: f.departureTime,
    arrival_time: f.arrivalTime,
    record_locator: f.recordLocator,
    passengers: f.passengers.map((p) => ({ name: p.name, seat: p.seat })),
  },
  null,
  2,
)}
        </pre>
      </SectionCard>
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
