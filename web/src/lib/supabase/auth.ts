// Supabase auth helpers — mirrors the shape of the old firebase/auth.ts so
// AuthProvider can lazy-import either without changing its call sites.

import { getSupabaseClient } from './client';

export interface SupabaseAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabaseClient();
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function sendSignInLink(email: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const sb = getSupabaseClient();
  await sb.auth.signOut();
}

export function onAuthChange(
  cb: (user: SupabaseAuthUser | null) => void,
): () => void {
  const sb = getSupabaseClient();
  const {
    data: { subscription },
  } = sb.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const u = session.user;
      cb({
        uid: u.id,
        email: u.email ?? null,
        displayName: u.user_metadata?.full_name ?? u.email ?? null,
        photoURL: u.user_metadata?.avatar_url ?? null,
      });
    } else {
      cb(null);
    }
  });
  return () => subscription.unsubscribe();
}
