import type { SourceKey } from '@/data/sources';

interface MockBadgeProps {
  source: SourceKey;
  /** Optional override label (defaults to "MOCK"). */
  label?: string;
  /** Show inline as tiny pill, or as a fuller info-strip. */
  variant?: 'pill' | 'strip';
  className?: string;
}

/**
 * Provenance mock badge — REMOVED app-wide (see CLAUDE.md "Provenance").
 * Renders nothing so its call sites stay valid; the blue `SourceTag` is kept.
 * Reversible: the original implementation lives in git history.
 */
export function MockBadge(_props: MockBadgeProps) {
  return null;
}
