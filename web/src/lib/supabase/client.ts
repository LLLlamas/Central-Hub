// Lazy Supabase client — only initializes when VITE_BACKEND=supabase and
// env vars are present. Importing this module with no config is a safe no-op.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function hasSupabaseConfig(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof url === 'string' && url.length > 0 && typeof key === 'string' && key.length > 0;
}

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase backend selected but config is missing. ' +
        'Copy web/.env.example to web/.env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.',
    );
  }
  _client = createClient(url, key);
  return _client;
}
