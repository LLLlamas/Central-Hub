import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { backend, BACKEND_KIND } from '@/lib/backend';
import { useAuth } from '@/state/AuthProvider';
import { useToursIndex } from '@/lib/useToursIndex';
import { createTourId, saveScratchTour } from '@/lib/scratchStorage';
import { createScratchTour } from '@/data/scratchTour';
import {
  buildTourSeed,
  fetchAttractionEvents,
  getTicketmasterApiKey,
  searchAttractions,
  type TmAttraction,
  type TourSeed,
} from '@/lib/ticketmaster';
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
import type { Membership, TourSummary, TourSummaryStatus } from '@/types';

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

// Supabase: a caller may hold an active membership in more than one tour.
// AuthGate has already ensured membershipStatus is 'active' for at least one
// of them by the time this mounts. The common case (exactly one active
// membership) keeps the old straight-in redirect; more than one renders a
// real switcher over Membership[] (not the local tours-index).
function MyShowsSupabaseRedirect() {
  const { membership, membershipLoading } = useAuth();
  const [memberships, setMemberships] = useState<Membership[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void backend.listMyMemberships?.().then((rows) => {
      if (!cancelled) setMemberships(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (membershipLoading || !membership || memberships === null) {
    return <LoadingSpinner label="Loading" />;
  }

  if (memberships.length <= 1) {
    return <Navigate to={tourPath(membership.tourId)} replace />;
  }

  return <MembershipSwitcher memberships={memberships} />;
}

// Tour creation on supabase (who becomes TM/PM of a brand-new shared tour,
// billing/tenancy) is out of scope here — this only switches between EXISTING
// active memberships, so there's no "+ New show" on this screen.
function MembershipSwitcher({ memberships }: { memberships: Membership[] }) {
  return (
    <div>
      <PageHeader
        eyebrow="Tour Hub"
        title="My Shows"
        description="Every tour you're an active member of. Pick one to jump in."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((m) => (
          <Link
            key={m.tourId}
            to={tourPath(m.tourId)}
            className="card p-4 hover:bg-[var(--color-paper)]/50 transition-colors block"
          >
            <div className="min-w-0">
              <div className="font-display text-[16px] font-bold text-[var(--color-ink)] truncate">
                {m.tourName || 'Untitled tour'}
              </div>
              {m.artistName && (
                <div className="text-[12.5px] text-[var(--color-ink-3)] truncate">{m.artistName}</div>
              )}
            </div>
            <div className="mt-3 text-[11.5px] text-[var(--color-ink-3)] capitalize">{m.role}</div>
          </Link>
        ))}
      </div>
    </div>
  );
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

  // Ticketmaster-seeded creation: same shell, pre-filled with the artist's
  // real upcoming schedule (show days only — no fabricated off/travel days).
  const handleCreateSeeded = (seed: TourSeed) => {
    if (creating) return;
    setCreating(true);
    const newId = createTourId();
    const freshTour = {
      ...createScratchTour(newId, seed.suggestedName),
      artistName: seed.artistName,
      startDate: seed.startDate,
      endDate: seed.endDate,
      legs: seed.legs,
      days: seed.days,
      scheduleItems: seed.scheduleItems,
      venues: seed.venues,
      status: 'in_progress' as const,
    };
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

      <NewShowModal
        open={newShowOpen}
        onClose={() => setNewShowOpen(false)}
        onCreate={handleCreate}
        onCreateSeeded={handleCreateSeeded}
      />

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
  onCreateSeeded,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  onCreateSeeded: (seed: TourSeed) => void;
}) {
  const hasApiKey = Boolean(getTicketmasterApiKey());
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmAttraction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [picked, setPicked] = useState<TmAttraction | null>(null);
  const [seed, setSeed] = useState<TourSeed | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setQuery('');
    setResults([]);
    setSearching(false);
    setSearchError(false);
    setPicked(null);
    setSeed(null);
    setEventsLoading(false);
    setEventsError(false);
  }, [open]);

  // Debounced artist search — the cancelled flag covers both the timer and an
  // in-flight fetch, so a stale response never overwrites a newer query's.
  useEffect(() => {
    if (!open || !hasApiKey) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(false);
    const t = setTimeout(async () => {
      try {
        const rows = await searchAttractions(q);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setSearchError(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, hasApiKey]);

  const handlePick = async (a: TmAttraction) => {
    setPicked(a);
    setSeed(null);
    setEventsError(false);
    setEventsLoading(true);
    try {
      const events = await fetchAttractionEvents(a.id);
      const built = buildTourSeed(a.name, events);
      setSeed(built);
      if (built.days.length === 0) setName(a.name);
    } catch {
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  };

  const trimmed = name.trim();
  const canCreate = trimmed.length > 0;

  return (
    <Modal open={open} onClose={onClose} eyebrow="New show" title="Start a tour" size="md">
      <div className="space-y-4">
        {hasApiKey ? (
          <div className="space-y-2">
            <label className="block">
              <span className="eyebrow block mb-1">Search an artist on Ticketmaster</span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]">
                  <Icon.Search size={13} />
                </span>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPicked(null);
                    setSeed(null);
                  }}
                  placeholder="e.g. Phish — seeds the tour with their real upcoming dates"
                  className="w-full h-9 pl-7 pr-2 text-[12.5px] rounded-[3px] border border-[var(--color-rule)] bg-[var(--color-card)]"
                />
              </div>
            </label>

            {searching && <p className="text-[12px] text-[var(--color-ink-3)]">Searching…</p>}
            {searchError && (
              <p className="text-[12px] text-[var(--color-accent)]">
                Search failed — check your connection and try again.
              </p>
            )}

            {!picked && !searching && results.length > 0 && (
              <ul className="border border-[var(--color-rule)] rounded-[3px] divide-y divide-[var(--color-rule)] max-h-56 overflow-y-auto">
                {results.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void handlePick(a)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-[var(--color-paper)]/60"
                    >
                      {a.imageUrl ? (
                        <img
                          src={a.imageUrl}
                          alt=""
                          className="w-10 h-6 object-cover rounded-[2px] shrink-0"
                        />
                      ) : (
                        <span className="w-10 h-6 rounded-[2px] bg-[var(--color-rule)] shrink-0" />
                      )}
                      <span className="text-[12.5px] font-semibold text-[var(--color-ink)] truncate">
                        {a.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {picked && (
              <div className="border border-[var(--color-rule)] rounded-[3px] p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  {picked.imageUrl && (
                    <img
                      src={picked.imageUrl}
                      alt=""
                      className="w-10 h-6 object-cover rounded-[2px] shrink-0"
                    />
                  )}
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                    {picked.name}
                  </span>
                </div>
                {eventsLoading && (
                  <p className="text-[12px] text-[var(--color-ink-3)]">Loading upcoming shows…</p>
                )}
                {eventsError && (
                  <p className="text-[12px] text-[var(--color-accent)]">
                    Couldn't load upcoming shows — try again, or start blank below.
                  </p>
                )}
                {seed && seed.days.length > 0 && (
                  <>
                    <p className="text-[12.5px] text-[var(--color-ink-2)]">
                      {seed.days.length} upcoming show{seed.days.length === 1 ? '' : 's'} ·{' '}
                      {fmtDate(seed.startDate, 'MMM d')} – {fmtDate(seed.endDate, 'MMM d, yyyy')}
                    </p>
                    <SeedCities seed={seed} />
                    <Button size="sm" variant="primary" onClick={() => onCreateSeeded(seed)}>
                      Create tour from these shows
                    </Button>
                  </>
                )}
                {seed && seed.days.length === 0 && (
                  <p className="text-[12px] text-[var(--color-ink-3)]">
                    No upcoming shows on Ticketmaster — start blank below (name prefilled).
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <span className="flex-1 h-px bg-[var(--color-rule)]" />
              <span className="eyebrow">or start blank</span>
              <span className="flex-1 h-px bg-[var(--color-rule)]" />
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] text-[var(--color-ink-3)]">
            Artist search is off — set VITE_TICKETMASTER_API_KEY in web/.env.local to seed a tour
            from an artist's real upcoming dates.
          </p>
        )}

        <label className="block">
          <span className="eyebrow block mb-1">Tour name</span>
          <input
            autoFocus={!hasApiKey}
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

function SeedCities({ seed }: { seed: TourSeed }) {
  const cities = [...new Set(seed.days.map((d) => d.city).filter((c): c is string => Boolean(c)))];
  if (cities.length === 0) return null;
  const shown = cities.slice(0, 6);
  const more = cities.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((c) => (
        <Chip key={c} tone="neutral" variant="outline" size="sm">
          {c}
        </Chip>
      ))}
      {more > 0 && (
        <Chip tone="neutral" variant="outline" size="sm">
          +{more} more
        </Chip>
      )}
    </div>
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
