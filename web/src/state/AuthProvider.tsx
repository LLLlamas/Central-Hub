// AuthProvider — mounted ABOVE AppStateProvider in main.tsx so auth gates the
// tour. On the default `local` backend it is a no-op passthrough that reports
// a synthetic "local" user, so nothing downstream changes and the app behaves
// byte-for-byte as today. On the `supabase` backend it subscribes to Supabase
// auth state and exposes sign-in/out actions.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { BACKEND_KIND, backend } from '@/lib/backend';
import type { Membership, MembershipStatus } from '@/types';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

// Backend-agnostic user shape so callers never import Supabase types.
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  // Membership gate (supabase only). On `local` it's a synthetic active TM so
  // the gate is always open and behavior is byte-identical to today.
  membership: Membership | null;
  membershipStatus: MembershipStatus;
  // True while resolving membership after sign-in (supabase only).
  membershipLoading: boolean;
  refreshMembership: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendSignInLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Synthetic active TM membership the local backend reports — keeps the gate
// open and lets AppState resolve a manager CurrentUser without any auth.
const LOCAL_MEMBERSHIP: Membership = {
  uid: 'local-user',
  tourId: '',
  email: '',
  role: 'owner',
  status: 'active',
  tourPersonId: '',
  displayName: 'Tour Manager',
  groupId: 'grp_mgmt',
  tagIds: [],
  joinedAt: '',
};

// Synthetic identity the local backend reports — keeps the app fully
// functional without a real login (matches today's no-auth sandbox behavior).
const LOCAL_USER: AuthUser = {
  uid: 'local-user',
  email: null,
  displayName: 'Tour Manager',
  photoURL: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function LocalAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      user: LOCAL_USER,
      status: 'signed-in',
      membership: LOCAL_MEMBERSHIP,
      membershipStatus: 'active',
      membershipLoading: false,
      refreshMembership: async () => {},
      signInWithGoogle: async () => {},
      sendSignInLink: async () => {},
      signOut: async () => {},
    }),
    [],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    // Lazy-import so the Supabase SDK never loads on the local backend.
    void import('@/lib/supabase/auth').then(({ onAuthChange }) => {
      unsub = onAuthChange((sbUser) => {
        setUser(sbUser);
        setStatus(sbUser ? 'signed-in' : 'signed-out');
        if (!sbUser) setMembership(null);
      });
    });
    return () => unsub();
  }, []);

  // On sign-in: claim the seeded membership (links uid by email, idempotent),
  // then resolve the caller's membership for the role-gate.
  const refreshMembership = useCallback(async () => {
    setMembershipLoading(true);
    try {
      await backend.claimMembership?.();
      const mem = await backend.getMyMembership?.();
      setMembership(mem ?? null);
    } catch {
      setMembership(null);
    } finally {
      setMembershipLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'signed-in') return;
    void refreshMembership();
  }, [status, user?.uid, refreshMembership]);

  const membershipStatus: MembershipStatus =
    membership?.status === 'active' ? 'active' : membership?.status === 'pending' ? 'pending' : 'none';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      membership,
      membershipStatus,
      membershipLoading,
      refreshMembership,
      signInWithGoogle: async () => {
        const m = await import('@/lib/supabase/auth');
        await m.signInWithGoogle();
      },
      sendSignInLink: async (email: string) => {
        const m = await import('@/lib/supabase/auth');
        await m.sendSignInLink(email);
      },
      signOut: async () => {
        const m = await import('@/lib/supabase/auth');
        await m.signOut();
      },
    }),
    [user, status, membership, membershipStatus, membershipLoading, refreshMembership],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return BACKEND_KIND === 'supabase' ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <LocalAuthProvider>{children}</LocalAuthProvider>
  );
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
