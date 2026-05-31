import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { useAuth } from '@/state/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FileDropZone } from '@/components/ingest/FileDropZone';
import { canSee } from '@/lib/visibility';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { DocumentSubmission, SubmissionType } from '@/types';

const SUBMISSION_TYPES: { value: SubmissionType; label: string; hint: string }[] = [
  { value: 'flight', label: 'Flight', hint: 'A boarding pass, e-ticket, or updated flight confirmation.' },
  { value: 'hotel', label: 'Hotel', hint: 'A booking confirmation or rooming change.' },
  { value: 'document', label: 'Document', hint: 'A set list, input list, or any tour document.' },
  { value: 'other', label: 'Other', hint: 'Anything else worth sharing with the team.' },
];

const inputClass =
  'w-full h-9 px-2.5 text-[13px] rounded-[3px] bg-[var(--color-paper-2)]/70 border border-transparent focus:border-[var(--color-rule)] focus:bg-[var(--color-card)] outline-none';

// "/me" — every active member's personal page: their travel, hotel, schedule,
// and rider plots, plus their own submissions and a Submit-a-document action.
// Reuses the same `canSee` / passenger-occupant filtering the day sheet uses.
export function MyTravelInfo() {
  const {
    tour,
    user,
    submissions,
    getScheduleItemsForDay,
  } = useApp();
  const { membership } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);

  const myPersonId = user.tourPersonId;
  const me = tour.personnel.find((p) => p.id === myPersonId);

  // Travel + hotels where the member is a passenger / occupant.
  const myTravel = useMemo(
    () => tour.travel.filter((t) => t.passengers.some((p) => p.tourPersonId === myPersonId)),
    [tour.travel, myPersonId],
  );
  const myHotels = useMemo(
    () => tour.hotels.filter((h) => h.occupants.some((o) => o.tourPersonId === myPersonId)),
    [tour.hotels, myPersonId],
  );

  // Schedule items the member is allowed to see, grouped by day, sorted.
  const myDays = useMemo(() => {
    return tour.days
      .map((d) => ({
        day: d,
        items: getScheduleItemsForDay(d.id)
          .filter((it) => canSee(it.visibility, user))
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
      .filter((d) => d.items.length > 0);
  }, [tour.days, getScheduleItemsForDay, user]);

  // Rider plots are visible to all members.
  const plots = useMemo(() => {
    const ri = tour.riderImports[0];
    if (!ri) return [];
    return ri.sections.flatMap((s) => s.plots ?? []);
  }, [tour.riderImports]);

  const mySubmissions = useMemo(
    () => submissions.filter((s) => !membership || s.uid === membership.uid || s.email === membership.email),
    [submissions, membership],
  );

  const dayById = (id: string) => tour.days.find((d) => d.id === id);

  return (
    <div>
      <PageHeader
        eyebrow="My travel & info"
        title={me?.person.name ? `Hi, ${me.person.name.split(' ')[0]}` : 'My travel & info'}
        description="Your flights, hotel, schedule, and plots — plus anything you've shared with the team."
        actions={
          <Button variant="primary" size="md" leading={<Icon.Plus size={14} />} onClick={() => setSubmitOpen(true)}>
            Submit a document
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Flights */}
        <Card padded={false}>
          <SectionHeader icon={<Icon.Plane size={14} />} title="My flights" count={myTravel.length} />
          {myTravel.length === 0 ? (
            <EmptyState title="No flights yet" hint="Your flights show here once travel is booked and approved." />
          ) : (
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {myTravel.map((t) => {
                const day = dayById(t.dayId);
                const seat = t.passengers.find((p) => p.tourPersonId === myPersonId)?.seat;
                return (
                  <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--color-ink)]">
                        {t.carrier} {t.identifier} · {t.from} › {t.to}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)] tabular">
                        {day ? fmtDate(day.date, 'EEE MMM d') : '—'} · {t.departTime} → {t.arriveTime}
                        {t.recordLocator ? ` · PNR ${t.recordLocator}` : ''}
                      </div>
                    </div>
                    {seat && (
                      <Chip tone="travel" size="sm" variant="outline">
                        Seat {seat}
                      </Chip>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Hotels */}
        <Card padded={false}>
          <SectionHeader icon={<Icon.Home size={14} />} title="My hotel" count={myHotels.length} />
          {myHotels.length === 0 ? (
            <EmptyState title="No hotel yet" hint="Your room shows here once a hotel block is added with your name." />
          ) : (
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {myHotels.map((h) => {
                const day = dayById(h.dayId);
                const occ = h.occupants.find((o) => o.tourPersonId === myPersonId);
                return (
                  <li key={h.id} className="px-5 py-3">
                    <div className="text-[13px] font-semibold text-[var(--color-ink)]">{h.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">{h.address}</div>
                    <div className="mt-1 text-[11px] text-[var(--color-ink-3)] tabular">
                      Check-in {day ? fmtDate(day.date, 'MMM d') : '—'} · {h.nights} night{h.nights === 1 ? '' : 's'}
                      {occ?.roomNumber ? ` · Room ${occ.roomNumber}` : ''}
                      {occ?.roomType ? ` · ${occ.roomType}` : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Schedule */}
        <Card padded={false}>
          <SectionHeader icon={<Icon.Clock size={14} />} title="My schedule" count={myDays.length} countLabel="days" />
          {myDays.length === 0 ? (
            <EmptyState title="Nothing on your schedule yet" hint="Call times you're cleared to see show here." />
          ) : (
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {myDays.map(({ day, items }) => (
                <li key={day.id} className="px-5 py-3">
                  <Link
                    to={`/daysheet/${day.date}`}
                    className="text-[12px] font-semibold text-[var(--color-ink)] hover:underline inline-flex items-center gap-1"
                  >
                    {fmtDate(day.date, 'EEE MMM d')}
                    {day.city ? ` · ${day.city}` : ''} <Icon.Chevron size={11} />
                  </Link>
                  <ul className="mt-1.5 space-y-0.5">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2 text-[12px] text-[var(--color-ink-2)]">
                        <span className="font-mono tabular text-[var(--color-ink-3)] w-12 shrink-0">{it.startTime}</span>
                        <span className="truncate">{it.title}</span>
                        {it.location && <span className="text-[var(--color-ink-4)] truncate">· {it.location}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Plots */}
        {plots.length > 0 && (
          <Card padded={false}>
            <SectionHeader icon={<Icon.Image size={14} />} title="Stage & light plots" count={plots.length} />
            <div className="p-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
              {plots.map((pl, i) => (
                <div key={`${pl.page}-${i}`} className="border border-[var(--color-rule-soft)] rounded-[3px] overflow-hidden bg-[var(--color-paper-2)]/40">
                  {pl.dataUrl ? (
                    <img src={pl.dataUrl} alt={pl.caption} className="w-full aspect-[4/3] object-contain bg-white" />
                  ) : (
                    <div className="w-full aspect-[4/3] flex items-center justify-center text-[var(--color-ink-4)]">
                      <Icon.Image size={24} />
                    </div>
                  )}
                  <div className="px-2.5 py-1.5 text-[11px] text-[var(--color-ink-3)] truncate">{pl.caption}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <Link to="/plots" className="text-[12px] font-semibold text-[var(--color-ocean)] hover:underline">
                Open Plots ›
              </Link>
            </div>
          </Card>
        )}

        {/* My submissions */}
        <Card padded={false}>
          <SectionHeader icon={<Icon.Inbox size={14} />} title="My submissions" count={mySubmissions.length} />
          {mySubmissions.length === 0 ? (
            <EmptyState
              title="Nothing submitted yet"
              hint="Use “Submit a document” above to send a boarding pass, an updated flight, or any doc to your TM for review."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-rule-soft)]">
              {mySubmissions.map((s) => (
                <SubmissionRow key={s.id} sub={s} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {submitOpen && <SubmitModal onClose={() => setSubmitOpen(false)} />}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  countLabel,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countLabel?: string;
}) {
  return (
    <div className="px-5 py-3 border-b border-[var(--color-rule-soft)] flex items-center gap-2">
      <span className="text-[var(--color-ink-3)]">{icon}</span>
      <span className="text-[13px] font-semibold text-[var(--color-ink)]">{title}</span>
      <Chip tone="neutral" size="sm" variant="outline">
        {count} {countLabel ?? ''}
      </Chip>
    </div>
  );
}

function StatusChip({ status }: { status: DocumentSubmission['status'] }) {
  const map = {
    pending: { tone: 'rehearsal' as const, label: 'Pending review' },
    approved: { tone: 'success' as const, label: 'Approved' },
    rejected: { tone: 'critical' as const, label: 'Rejected' },
  };
  const m = map[status];
  return (
    <Chip tone={m.tone} size="sm" variant="soft">
      {m.label}
    </Chip>
  );
}

function SubmissionRow({ sub }: { sub: DocumentSubmission }) {
  const { loadSubmissionFileUrl } = useApp();

  const openFile = async () => {
    const url = await loadSubmissionFileUrl(sub);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  return (
    <li className="px-5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--color-ink)] truncate">{sub.title || sub.filename || 'Untitled'}</span>
            <Chip tone="neutral" size="sm" variant="outline">
              {sub.type}
            </Chip>
          </div>
          {sub.description && <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">{sub.description}</div>}
          <div className="mt-1 text-[10.5px] font-mono tabular text-[var(--color-ink-4)]">
            {sub.submittedAt.replace('T', ' ')}
            {sub.filename ? ` · ${sub.filename}` : ''}
          </div>
          {sub.status === 'rejected' && sub.reviewNote && (
            <div className="mt-1 text-[11.5px] text-[var(--color-accent)]">Reason: {sub.reviewNote}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusChip status={sub.status} />
          {(sub.storagePath || sub.filename) && (
            <button
              type="button"
              onClick={openFile}
              className="text-[11.5px] font-semibold text-[var(--color-ocean)] hover:underline"
            >
              View file
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function SubmitModal({ onClose }: { onClose: () => void }) {
  const { proposeSubmission } = useApp();
  const [type, setType] = useState<SubmissionType>('flight');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = title.trim().length > 0 || !!file;
  const typeHint = SUBMISSION_TYPES.find((t) => t.value === type)?.hint;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await proposeSubmission(
        { type, title: title.trim() || file?.name || 'Untitled', description: description.trim() },
        file ?? undefined,
      );
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} eyebrow="Submit a document" title="Send a document for review">
      {done ? (
        <div className="space-y-4">
          <div className="rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 px-4 py-3 text-[13px] text-[var(--color-ink-2)] flex items-start gap-2">
            <Icon.Check size={16} className="text-[var(--color-moss)] shrink-0 mt-0.5" />
            <span>
              Submitted. Your TM/PM will review it and either add it to the tour or get back to you. It shows under
              <strong> My submissions</strong> as pending until then.
            </span>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
            Anything you send lands as <strong>pending</strong> — it never changes the tour until your TM/PM approves it.
          </p>
          <div>
            <div className="eyebrow mb-1.5">Type</div>
            <select value={type} onChange={(e) => setType(e.target.value as SubmissionType)} className={inputClass}>
              {SUBMISSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {typeHint && <p className="mt-1 text-[11.5px] text-[var(--color-ink-4)]">{typeHint}</p>}
          </div>
          <div>
            <div className="eyebrow mb-1.5">Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My MEX → MTY boarding pass"
              className={inputClass}
            />
          </div>
          <div>
            <div className="eyebrow mb-1.5">Notes (optional)</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything the TM should know."
              rows={3}
              className={cn(inputClass, 'h-auto py-2 resize-y')}
            />
          </div>
          <div>
            <div className="eyebrow mb-1.5">File (optional)</div>
            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-paper-2)]/50 px-3 py-2">
                <span className="text-[12.5px] font-mono text-[var(--color-ink-2)] truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
                  <Icon.X size={13} />
                </button>
              </div>
            ) : (
              <FileDropZone
                accept=".pdf,image/*"
                onFiles={(files) => setFile(files[0] ?? null)}
                title="Drop a PDF or image"
                hint="Boarding pass, confirmation, set list — PDF or photo."
                icon={<Icon.Document size={22} />}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={!canSubmit || busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
