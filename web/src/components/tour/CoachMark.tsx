import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { Icon } from '@/components/ui/Icon';
import { useTour } from './TourProvider';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Coach-mark overlay for the Start From Scratch walkthrough. Spotlights the
 * step's `data-tour` target with a dimmed cut-out + halo and an instruction
 * bubble; falls back to a centered bubble for transition steps or when the
 * target isn't on the page. The dim is pointer-events-none so the user
 * interacts with the real UI (dropping files) straight through it.
 */
export function CoachMark() {
  const { tour } = useApp();
  const { running, step, stepIndex, stepCount, next, back, exit } = useTour();
  const { pathname } = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledFor = useRef<string | null>(null);

  // Measure the spotlight target, re-measuring briefly to catch navigation +
  // layout settle, then track scroll/resize. Re-runs on route change and on
  // tour-data changes (an import can move or reveal the target).
  useEffect(() => {
    if (!running || !step?.target) {
      setRect(null);
      return;
    }
    const targetSel = `[data-tour="${step.target}"]`;
    let raf = 0;
    const startedAt = Date.now();
    const tick = () => {
      const el = document.querySelector(targetSel);
      if (el) {
        if (scrolledFor.current !== step.id) {
          scrolledFor.current = step.id;
          // Place the target ~25% from the top of the viewport so the bubble
          // (which renders below the target when below === true) always has
          // room to fit on screen — even when the target sits near the bottom
          // of the document (e.g. the hotel dropzone on /ingest/flights).
          // Instant scroll (not smooth) so the new rect is correct on the
          // same render tick — smooth scroll caused the bubble to render
          // against the pre-scroll rect when steps changed quickly.
          const r = el.getBoundingClientRect();
          const targetTop = r.top + window.scrollY - window.innerHeight * 0.25;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
      if (Date.now() - startedAt < 1300) raf = requestAnimationFrame(tick);
    };
    tick();
    const onMove = () => {
      const el = document.querySelector(targetSel);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [running, step, pathname, tour]);

  // Escape exits the tour.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, exit]);

  if (!running || !step) return null;

  const isLast = stepIndex === stepCount - 1;
  const isFirst = stepIndex === 0;
  const pad = 8;

  // Bubble placement: anchored to the target, or centered for transition steps.
  let bubbleStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom < window.innerHeight * 0.62;
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - 352),
    );
    bubbleStyle = below
      ? { top: rect.bottom + pad + 10, left }
      : { bottom: window.innerHeight - rect.top + pad + 10, left };
  } else {
    bubbleStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const overlay = (
    <div className="fixed inset-0 z-[120] pointer-events-none">
      {rect ? (
        <div
          className="absolute rounded-[8px]"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(15,12,8,0.55)',
            outline: '2px solid var(--color-ocean)',
            outlineOffset: '0px',
            transition: prefersReducedMotion ? undefined : 'all 0.25s ease',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(15,12,8,0.55)' }} />
      )}

      <div
        role="dialog"
        aria-label="Walkthrough"
        className="pointer-events-auto absolute w-[340px] max-w-[calc(100vw-1.5rem)] rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-card)] shadow-[0_8px_30px_rgba(0,0,0,0.22)]"
        style={bubbleStyle}
      >
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ocean)]">
              Walkthrough · {stepIndex + 1}/{stepCount}
            </span>
            {!isLast && (
              <button
                type="button"
                onClick={exit}
                className="text-[11px] font-semibold text-[var(--color-ink-4)] hover:text-[var(--color-ink)]"
              >
                Skip
              </button>
            )}
          </div>
          <h3 className="mt-1.5 text-[14.5px] font-semibold text-[var(--color-ink)] leading-snug">
            {step.title}
          </h3>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
            {step.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[var(--color-rule-soft)]">
          <div className="flex items-center gap-1">
            {Array.from({ length: stepCount }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{
                  background:
                    i === stepIndex ? 'var(--color-ocean)' : 'var(--color-rule)',
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[12px] font-semibold rounded-[3px] border border-[var(--color-rule)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-4)]"
              >
                <Icon.Chevron size={11} className="rotate-180" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 h-7 px-3 text-[12px] font-semibold rounded-[3px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)]"
            >
              {isLast ? 'Got it' : 'Next'}
              {!isLast && <Icon.Chevron size={11} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
