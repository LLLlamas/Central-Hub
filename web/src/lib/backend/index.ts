// Backend selector. Defaults to `local` so the app behaves exactly as today
// unless VITE_BACKEND=supabase is explicitly set. Importing this module is
// always safe — the supabase client does not init at load time.

import type { Backend } from './types';
import { localBackend } from './local';
import { supabaseBackend } from './supabase';

export const BACKEND_KIND: 'local' | 'supabase' =
  (import.meta.env.VITE_BACKEND as 'local' | 'supabase') ?? 'local';

export const backend: Backend = BACKEND_KIND === 'supabase' ? supabaseBackend : localBackend;

export type { Backend, Unsub, PdfScope } from './types';
