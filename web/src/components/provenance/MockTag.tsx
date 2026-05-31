import type { SourceKey } from '@/data/sources';

interface MockTagProps {
  source: SourceKey;
  /** Override the displayed label (default: "(mock)"). */
  label?: string;
  /** Optional note specific to this value (overrides registry detail). */
  note?: string;
  /** Optional name of the specific field this tag annotates, for the modal title. */
  field?: string;
  className?: string;
}

/**
 * Provenance "(mock)" flag — REMOVED app-wide (see CLAUDE.md "Provenance").
 * Renders nothing so its ~40 call sites stay valid with zero layout risk; the
 * blue real-source `SourceTag` citations are kept. Reversible: the original
 * implementation lives in git history.
 */
export function MockTag(_props: MockTagProps) {
  return null;
}
