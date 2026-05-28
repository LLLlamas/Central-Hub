import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { useTour } from '@/components/tour/TourProvider';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/**
 * Onboarding strip — shown above page content while the user is building a
 * tour from scratch. Carries the import checklist (route → rider → flights)
 * plus the Walkthrough and Reset controls. Not rendered in PrintLayout.
 */
export function ScratchBanner() {
  const { tour, resetScratchTour } = useApp();
  const { start: startTour } = useTour();
  const [confirmReset, setConfirmReset] = useState(false);

  const steps = [
    { label: 'Import route', done: tour.days.length > 0, to: '/ingest/flights' },
    { label: 'Import rider', done: tour.riderImports.length > 0, to: '/ingest/riders' },
    {
      label: 'Import flights',
      done: tour.flightImports.some((f) => f.status === 'imported'),
      to: '/ingest/flights',
    },
    { label: 'Import hotels', done: tour.hotels.length > 0, to: '/ingest/flights' },
  ];

  return (
    <>
      <div className="border-b border-[rgba(160,122,46,0.35)] bg-[rgba(160,122,46,0.07)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-5 md:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-ink)]">
            <Icon.Sparkle size={13} className="text-[var(--color-day-rehearsal)]" />
            Start from scratch — building {tour.name || 'a new tour'}
          </div>

          <ol className="flex items-center gap-1.5 flex-wrap">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--color-ink-4)]">·</span>}
                <Link
                  to={s.to}
                  className="inline-flex items-center gap-1 text-[11.5px] font-mono uppercase tracking-[0.06em] hover:text-[var(--color-ink)]"
                  style={{ color: s.done ? 'var(--color-moss)' : 'var(--color-ink-3)' }}
                >
                  {s.done ? <Icon.Check size={11} /> : <span className="w-[11px]" />}
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={startTour}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-ocean)] hover:text-[var(--color-ink)]"
            >
              <Icon.Sparkle size={12} /> Walkthrough
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-[11.5px] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        eyebrow="Scratch mode"
        title="Reset this tour?"
        size="sm"
      >
        <p className="text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
          This clears everything you've imported — route, rider, and flights — and
          starts the scratch tour from an empty shell. This can't be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetScratchTour();
              setConfirmReset(false);
            }}
          >
            Reset tour
          </Button>
        </div>
      </Modal>
    </>
  );
}
