// Full-screen loading state — shared markup for every "the tour/app is still
// booting" surface (Layout's `booting` gate, MigrationGate, the supabase
// single-tour redirect). Only the aria-label differs per call site.
export function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)]">
      <div
        className="w-6 h-6 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin"
        role="status"
        aria-label={label}
      />
    </div>
  );
}
