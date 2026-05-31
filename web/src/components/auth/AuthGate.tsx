import type { ReactNode } from 'react';
import { BACKEND_KIND } from '@/lib/backend';
import { useAuth } from '@/state/AuthProvider';
import { LoginScreen } from './LoginScreen';
import { WaitingForAccess } from './WaitingForAccess';

// Session + role gate between AuthProvider and AppStateProvider. On `local` it
// is a passthrough (never gated). On `supabase`: spinner while auth/membership
// resolve, login when signed out, the Waiting screen until a manager grants an
// active membership, and the app once `membershipStatus === 'active'`.
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, membershipStatus, membershipLoading } = useAuth();

  if (BACKEND_KIND !== 'supabase') return <>{children}</>;

  if (status === 'loading' || (status === 'signed-in' && membershipLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)]">
        <div
          className="w-6 h-6 rounded-full border-2 border-[var(--color-rule)] border-t-[var(--color-ink)] animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (status === 'signed-out') return <LoginScreen />;

  // Signed in but no active membership → waiting for a manager to assign a role.
  if (membershipStatus !== 'active') return <WaitingForAccess />;

  return <>{children}</>;
}
