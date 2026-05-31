import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PdfViewerInline } from '@/components/PdfViewer';
import { parseFlightPdf, parseHotelPdf } from '@/lib/pdfParser';
import { cn } from '@/lib/cn';
import type { DocumentSubmission, SubmissionStatus, DocumentKind } from '@/types';

// "/submissions" — the manager inbox. Mirrors the FlightIngest two-pane review
// layout: a list rail on the left (pending first, with a badge count), a detail
// pane on the right showing the file + submitter + notes and Approve / Reject.
// Manager-gated. On approve, flight/hotel submissions route through the existing
// parse → flight-review / hotel-import path so Travel/Hotel + day sheets update;
// document/other submissions attach as a tour Document.
export function SubmissionsInbox() {
  const { user, submissions, refreshSubmissions } = useApp();
  const managerView = user.groupId === 'grp_mgmt' || user.groupId === 'grp_production';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void refreshSubmissions();
  }, [refreshSubmissions]);

  const ordered = useMemo(() => {
    const rank: Record<SubmissionStatus, number> = { pending: 0, approved: 1, rejected: 2 };
    return [...submissions].sort(
      (a, b) => rank[a.status] - rank[b.status] || b.submittedAt.localeCompare(a.submittedAt),
    );
  }, [submissions]);

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const selected = ordered.find((s) => s.id === selectedId) ?? ordered.find((s) => s.status === 'pending') ?? ordered[0];

  if (!managerView) {
    return (
      <div>
        <PageHeader eyebrow="Submissions" title="Submissions inbox" />
        <Card>
          <EmptyState title="Managers only" hint="Only the TM/PM review submitted documents." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Submissions"
        title="Submissions inbox"
        description="Documents your crew sent in for review. Approve to add them to the tour, or reject with a reason."
        meta={
          pendingCount > 0 ? (
            <Chip tone="rehearsal" size="sm" variant="soft">
              {pendingCount} pending
            </Chip>
          ) : undefined
        }
      />

      {ordered.length === 0 ? (
        <Card>
          <EmptyState
            title="No submissions yet"
            hint="When crew submit a boarding pass, an updated flight, or any document from their My Travel & Info page, it lands here for review."
          />
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-rule-soft)]">
              <div className="eyebrow">Submissions</div>
              <div className="text-[11.5px] text-[var(--color-ink-3)] mt-0.5">
                {ordered.length} total · {pendingCount} pending
              </div>
            </div>
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {ordered.map((s) => {
                const active = s.id === selected?.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-[var(--color-paper)]/60 transition-colors',
                        active && 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusChip status={s.status} inverted={active} />
                        <Chip tone="neutral" size="sm" variant={active ? 'outline' : 'soft'}>
                          {s.type}
                        </Chip>
                      </div>
                      <div className={cn('text-[12.5px] font-semibold truncate', active ? 'text-[var(--color-paper)]' : 'text-[var(--color-ink)]')}>
                        {s.title || s.filename || 'Untitled'}
                      </div>
                      <div className={cn('text-[10.5px] font-mono mt-1 tabular', active ? 'text-[var(--color-paper)] opacity-75' : 'text-[var(--color-ink-4)]')}>
                        {s.displayName || s.email} · {s.submittedAt.replace('T', ' ')}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? <SubmissionDetail sub={selected} /> : <EmptyState title="Select a submission" />}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status, inverted }: { status: SubmissionStatus; inverted?: boolean }) {
  const map = {
    pending: { tone: 'rehearsal' as const, label: 'Pending' },
    approved: { tone: 'success' as const, label: 'Approved' },
    rejected: { tone: 'critical' as const, label: 'Rejected' },
  };
  const m = map[status];
  return (
    <Chip tone={m.tone} variant={inverted ? 'outline' : 'soft'} size="sm">
      {m.label}
    </Chip>
  );
}

const DOC_KIND_BY_TYPE: Record<DocumentSubmission['type'], DocumentKind> = {
  flight: 'advance',
  hotel: 'advance',
  document: 'other',
  other: 'other',
};

function SubmissionDetail({ sub }: { sub: DocumentSubmission }) {
  const {
    tour,
    loadSubmissionFileUrl,
    approveSubmission,
    rejectSubmission,
    addDocument,
    addFlightImportToScratch,
    addHotelImportToScratch,
  } = useApp();
  const navigate = useNavigate();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [routed, setRouted] = useState<string | null>(null);

  const isPdf = sub.filename?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(sub.filename ?? '');

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void loadSubmissionFileUrl(sub).then((u) => {
      if (cancelled) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      url = u;
      setFileUrl(u);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setFileUrl(null);
    };
  }, [sub, loadSubmissionFileUrl]);

  // Approve: route the file to the right destination so it persists everywhere.
  //   flight → parse + queue into the flight review surface (duplicate/merge/
  //            commit happens there, linking passengers + updating the day sheet)
  //   hotel  → parse + import (no review step; adds Hotel + advance tasks)
  //   doc/other → attach as a tour Document
  const handleApprove = async () => {
    setBusy(true);
    try {
      let routeTo: string | null = null;
      if ((sub.type === 'flight' || sub.type === 'hotel') && fileUrl && sub.filename) {
        const blob = await (await fetch(fileUrl)).blob();
        const file = new File([blob], sub.filename, { type: blob.type || 'application/pdf' });
        if (sub.type === 'flight') {
          try {
            const fi = await parseFlightPdf(file, tour.personnel);
            if (fi.status !== 'failed' && fi.parsedFlights.length > 0) {
              addFlightImportToScratch(fi);
              routeTo = '/ingest/flights';
            }
          } catch {
            /* parse failed — still attach as a document below */
          }
        } else {
          try {
            const { hotels, tasks } = await parseHotelPdf(file, tour.personnel, tour.days);
            if (hotels.length > 0) {
              addHotelImportToScratch(hotels, tasks, sub.filename);
              routeTo = '/ingest/flights';
            }
          } catch {
            /* parse failed — still attach as a document below */
          }
        }
      }
      // Always attach the source file as a tour Document so it's stored + visible.
      addDocument({
        kind: DOC_KIND_BY_TYPE[sub.type],
        title: sub.title || sub.filename || 'Submitted document',
        liveLink: fileUrl ?? '',
      });
      await approveSubmission(sub.id, routeTo ? 'Imported into the tour.' : 'Attached to the tour.');
      if (routeTo) setRouted(routeTo);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setBusy(true);
    try {
      await rejectSubmission(sub.id, rejectReason.trim());
      setRejectOpen(false);
      setRejectReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--color-rule-soft)] flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="eyebrow">{sub.type} submission</div>
          <div className="mt-1 text-[15px] font-semibold text-[var(--color-ink)]">{sub.title || sub.filename || 'Untitled'}</div>
          <div className="mt-1 text-[12px] text-[var(--color-ink-3)]">
            From <span className="font-semibold text-[var(--color-ink-2)]">{sub.displayName || sub.email}</span> ·{' '}
            {sub.submittedAt.replace('T', ' ')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={sub.status} />
          {sub.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" leading={<Icon.X size={12} />} onClick={() => setRejectOpen(true)} disabled={busy}>
                Reject
              </Button>
              <Button size="sm" variant="primary" leading={<Icon.Check size={12} />} onClick={handleApprove} disabled={busy}>
                {busy ? 'Approving…' : 'Approve'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {sub.description && (
          <div className="rounded-[3px] border border-[var(--color-rule-soft)] bg-[var(--color-paper-2)]/40 px-3.5 py-2.5">
            <div className="eyebrow mb-1">Notes from submitter</div>
            <div className="text-[12.5px] text-[var(--color-ink-2)] leading-relaxed">{sub.description}</div>
          </div>
        )}

        {sub.status === 'rejected' && sub.reviewNote && (
          <div className="rounded-[3px] border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--color-ink-2)]">
            <strong>Rejected:</strong> {sub.reviewNote}
          </div>
        )}
        {sub.status === 'approved' && (
          <div className="rounded-[3px] border border-[var(--color-moss)] bg-[var(--color-moss)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--color-ink-2)] flex items-center gap-2">
            <Icon.Check size={14} className="text-[var(--color-moss)]" />
            {sub.reviewNote ?? 'Approved.'}
            {sub.reviewedBy ? ` — ${sub.reviewedBy}` : ''}
          </div>
        )}

        {routed && (
          <div className="rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 px-3.5 py-2.5 text-[12.5px] text-[var(--color-ink-2)] flex items-center justify-between gap-3">
            <span>
              {sub.type === 'flight'
                ? 'Queued into flight review — finish duplicate / merge / approve there.'
                : 'Hotel imported into the tour.'}
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate(routed)}>
              Open {sub.type === 'flight' ? 'flight review' : 'route & travel'} ›
            </Button>
          </div>
        )}

        <div>
          <div className="eyebrow mb-2">Submitted file</div>
          {!sub.filename ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)] italic">No file attached — this is a text-only submission.</p>
          ) : !fileUrl ? (
            <p className="text-[12.5px] text-[var(--color-ink-3)]">Loading file…</p>
          ) : isPdf ? (
            <PdfViewerInline url={fileUrl} title={sub.filename} height="60vh" />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt={sub.filename}
              className="max-h-[60vh] w-auto rounded-[3px] border border-[var(--color-rule)] bg-white"
            />
          ) : (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-[var(--color-ocean)] hover:underline">
              Open {sub.filename} ›
            </a>
          )}
        </div>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} eyebrow="Reject submission" title={sub.title || sub.filename || 'Untitled'}>
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
            Let the submitter know why — it shows on their My Travel & Info page next to this submission.
          </p>
          <textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. This is the old flight — please send the rebooked one."
            rows={3}
            className="w-full px-2.5 py-2 text-[13px] rounded-[3px] bg-[var(--color-paper-2)]/70 border border-transparent focus:border-[var(--color-rule)] focus:bg-[var(--color-card)] outline-none resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleReject} disabled={!rejectReason.trim() || busy}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
