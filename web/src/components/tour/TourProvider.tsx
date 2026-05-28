import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppState';
import { scratchTourSteps } from './scratchTourSteps';
import type { TourStep } from './scratchTourSteps';

interface TourState {
  running: boolean;
  stepIndex: number;
  step: TourStep | null;
  stepCount: number;
  start: () => void;
  next: () => void;
  back: () => void;
  exit: () => void;
}

const Ctx = createContext<TourState | null>(null);
const SEEN_KEY = 'tour-hub:walkthrough-seen';

function hasSeenWalkthrough(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(SEEN_KEY) === '1';
}
function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Drives the Start From Scratch coach-mark walkthrough: tracks the active
 * step, auto-navigates between routes, and auto-advances hands-on steps when
 * the user completes the matching import. Lives inside `Layout` so it persists
 * across route changes and can read both `useApp()` and the router.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { tour } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = scratchTourSteps;
  const step = running ? steps[stepIndex] ?? null : null;

  const start = useCallback(() => {
    setStepIndex(0);
    setRunning(true);
  }, []);
  const exit = useCallback(() => {
    setRunning(false);
    markSeen();
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) {
        setRunning(false);
        markSeen();
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);
  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // Take the user to the step's route when it differs from where they are.
  useEffect(() => {
    if (!running || !step) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [running, step, location.pathname, navigate]);

  // Auto-advance a hands-on step once its completion predicate is satisfied.
  useEffect(() => {
    if (!running || !step?.advanceWhen) return;
    if (!step.advanceWhen(tour)) return;
    const t = setTimeout(next, 650); // a short beat so the user sees the result land
    return () => clearTimeout(t);
  }, [running, step, tour, next]);

  // Auto-start once for a brand-new user with an untouched tour.
  useEffect(() => {
    if (!hasSeenWalkthrough() && tour.days.length === 0 && tour.riderImports.length === 0) {
      start();
    }
    // Mount-only: a one-shot intro on first arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: TourState = {
    running,
    stepIndex,
    step,
    stepCount: steps.length,
    start,
    next,
    back,
    exit,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour(): TourState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used inside TourProvider');
  return v;
}
