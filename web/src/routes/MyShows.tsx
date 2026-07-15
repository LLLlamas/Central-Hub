import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BACKEND_KIND } from '@/lib/backend';
import { useAuth } from '@/state/AuthProvider';
import { useToursIndex } from '@/lib/useToursIndex';
import { createTourId, saveScratchTour } from '@/lib/scratchStorage';
import { createScratchTour } from '@/data/scratchTour';
import { MyShowsMap } from '@/components/MyShowsMap';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';
import { tourPath } from '@/lib/routing';
import { TOUR_STATUS_LABEL } from '@/lib/tourSummary';
import type { TourSummary, TourSummaryStatus } from '@/types';

const STATUS_CHIP_TONE: Record<TourSummaryStatus, 'neutral' | 'hold' | 'success' | 'off'> = {
  draft: 'neutral',
  upcoming: 'hold',
  on_tour: 'success',
  completed: 'off',
};

export function MyShows() {
  if (BACKEND_KIND === 'supabase') return <MyShowsSupabaseRedirect />;
  return <MyShowsList />;
}

// Supabase carve-out: this backend doesn't yet support multiple tours, so
// there's nothing to list — resolve the caller's one membership and hop
// straight into their tour. AuthGate has already ensured membershipStatus is
// 'active' by the time this mounts, but we still guard on membership being
// resolved before navigating.
function MyShowsSupabaseRedirect() {
  const { membership, membershipLoading } = useAuth();

  if (membershipLoading || !membership) {
    return <LoadingSpinner label="Loading" />;
  }

  return <Navigate to={tourPath(membership.tourId)} replace />;
}

function MyShowsList() {
  const tours = useToursIndex();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newShowOpen, setNewShowOpen] = useState(false);

  const byStatus = (status: TourSummaryStatus) => tours.filter((t) => t.status === status);

  // Ask for a name up front — otherwise every new draft shares the same
  // placeholder title and is indistinguishable from the others in this list.
  const handleCreate = (name: string) => {
    if (creating) return;
    setCreating(true);
    const newId = createTourId();
    const freshTour = createScratchTour(newId, name);
    saveScratchTour(newId, freshTour);
    navigate(tourPath(newId));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tour Hub"
        title="My Shows"
        description="Every tour you run, in one place. Pick one up where you left off, or start a new one from scratch."
        actions={
          <button
            type="button"
            onClick={() => setNewShowOpen(true)}
            disabled={creating}
            className="min-h-11 md:min-h-9 inline-flex items-center gap-1.5 px-3.5 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)] disabled:opacity-60"
          >
            <Icon.Plus size={14} /> New show
          </button>
        }
      />

      <NewShowModal open={newShowOpen} onClose={() => setNewShowOpen(false)} onCreate={handleCreate} />

      <div className="mb-5">
        <MyShowsMap tours={tours} />
      </div>

      {tours.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[13px] text-[var(--color-ink-3)]">
            No shows yet — click "New show" to start building your first tour.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <CollapsibleSection
            title="On tour now"
            eyebrow="Live"
            defaultOpen
            badge={
              <Chip tone="success" variant="outline" size="sm">
                {byStatus('on_tour').length}
              </Chip>
            }
          >
            <TourGrid tours={byStatus('on_tour')} emptyLabel="No shows currently on tour." />
          </CollapsibleSection>

          <CollapsibleSection
            title="Upcoming"
            eyebrow="On the calendar"
            defaultOpen
            badge={
              <Chip tone="neutral" variant="outline" size="sm">
                {byStatus('upcoming').length}
              </Chip>
            }
          >
            <TourGrid tours={byStatus('upcoming')} emptyLabel="No upcoming shows." />
          </CollapsibleSection>

          <CollapsibleSection
            title="Drafts"
            eyebrow="Needs building"
            defaultOpen
            badge={
              <Chip tone="neutral" variant="outline" size="sm">
                {byStatus('draft').length}
              </Chip>
            }
          >
            <TourGrid tours={byStatus('draft')} emptyLabel="No drafts in progress." />
          </CollapsibleSection>

          <CollapsibleSection
            title="Completed"
            eyebrow="Wrapped"
            defaultOpen={false}
            badge={
              <Chip tone="neutral" variant="outline" size="sm">
                {byStatus('completed').length}
              </Chip>
            }
          >
            <TourGrid tours={byStatus('completed')} emptyLabel="No completed shows yet." />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function NewShowModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0;

  return (
    <Modal open={open} onClose={onClose} eyebrow="New show" title="Name this tour" size="sm">
      <div className="space-y-4">
        <label className="block">
          <span className="eyebrow block mb-1">Tour name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) onCreate(trimmed);
            }}
            placeholder="e.g. the artist or the run — you can change this later"
            className="w-full h-9 px-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)]"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" disabled={!canCreate} onClick={() => onCreate(trimmed)}>
            Create show
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TourGrid({ tours, emptyLabel }: { tours: TourSummary[]; emptyLabel: string }) {
  if (tours.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-ink-3)]">{emptyLabel}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((t) => (
        <TourCard key={t.id} tour={t} />
      ))}
    </div>
  );
}

function TourCard({ tour }: { tour: TourSummary }) {
  const dateRange =
    tour.startDate && tour.endDate
      ? `${fmtDate(tour.startDate, 'MMM d')} - ${fmtDate(tour.endDate, 'MMM d, yyyy')}`
      : 'No dates yet';

  return (
    <Link
      to={tourPath(tour.id)}
      className="card p-4 hover:bg-[var(--color-paper)]/50 transition-colors block"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-[16px] font-bold text-[var(--color-ink)] truncate">
            {tour.name}
          </div>
          {tour.artistName && (
            <div className="text-[12.5px] text-[var(--color-ink-3)] truncate">{tour.artistName}</div>
          )}
        </div>
        <Chip tone={STATUS_CHIP_TONE[tour.status]} size="sm" className="shrink-0">
          {TOUR_STATUS_LABEL[tour.status]}
        </Chip>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px] text-[var(--color-ink-3)]">
        <span>{dateRange}</span>
        <span className="font-mono">
          {tour.showCount} show{tour.showCount === 1 ? '' : 's'}
        </span>
      </div>
    </Link>
  );
}
