import { useEffect, useState } from 'react';
import { useAuth } from '@/state/AuthProvider';
import { backend } from '@/lib/backend';
import { Icon } from '@/components/ui/Icon';
import type { TourGroupSummary } from '@/types';

// Shown on the supabase backend when a user is signed in but has no active
// membership yet (status none/pending). Reuses LoginScreen's card styling.
// Lets the user pick the group they think they're on (a hint for the assigning
// TM/PM) and nudge a manager. Once a manager grants an active role, refreshing
// membership drops them into the app.
export function WaitingForAccess() {
  const { user, membership, signOut, refreshMembership } = useAuth();
  const tourId = membership?.tourId ?? '';
  const [groups, setGroups] = useState<TourGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupId, setGroupId] = useState(membership?.requestedGroupId ?? '');
  const [nudged, setNudged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void backend
      .listActiveTourGroups?.()
      .then((g) => {
        if (!cancelled) setGroups(g ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingGroups(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGroups = groups.length > 0;

  async function onNudge() {
    if (!tourId) return;
    setBusy(true);
    try {
      await backend.nudge?.(tourId, groupId || undefined);
      setNudged(true);
    } finally {
      setBusy(false);
    }
  }

  async function onCheckAccess() {
    setBusy(true);
    try {
      await refreshMembership();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--color-paper)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-ink)]">Tour Hub</h1>
          <p className="mt-1.5 text-[13px] text-[var(--color-ink-3)] leading-relaxed">
            Waiting for access — a manager needs to add you to the tour.
          </p>
        </div>

        <div className="rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-card)] shadow-sm p-5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-paper-2)] text-[var(--color-ink-2)] mb-3">
            <Icon.Lock size={18} />
          </div>
          <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">
            You're signed in as{' '}
            <span className="font-medium text-[var(--color-ink-2)]">
              {user?.email ?? user?.displayName}
            </span>
          </p>
          <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
            Your TM or PM assigns roles. Tell them which group you're on so they can place you
            faster.
          </p>

          <div className="mt-4">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ink-3)]">
              Which group are you on?
            </span>
            {loadingGroups ? (
              <div className="mt-1.5 h-10 rounded-[4px] bg-[var(--color-paper-2)]/60 animate-pulse" />
            ) : hasGroups ? (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-1.5 w-full h-10 px-3 text-[13.5px] rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-ink-4)]"
              >
                <option value="">I'm not sure</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1.5 text-[12px] text-[var(--color-ink-3)] leading-relaxed italic">
                Your TM/PM hasn't set up groups yet — nudge them to get added.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onNudge}
            disabled={busy || !tourId}
            className="mt-4 w-full h-10 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nudged ? 'Nudge sent' : busy ? 'Sending…' : 'Nudge my TM/PM'}
          </button>
          {nudged && (
            <p className="mt-2 text-[11.5px] text-[var(--color-moss)] leading-snug text-center">
              We let your managers know. They'll see your group guess on the permissions screen.
            </p>
          )}

          <button
            type="button"
            onClick={onCheckAccess}
            disabled={busy}
            className="mt-2 w-full h-10 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check for access
          </button>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 w-full text-center text-[12px] font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)] underline underline-offset-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
