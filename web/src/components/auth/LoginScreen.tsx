import { useState, type FormEvent } from 'react';
import { useAuth } from '@/state/AuthProvider';
import { Icon } from '@/components/ui/Icon';

// Sign-in surface shown only on the supabase backend when signed out. Offers an
// email magic-link and Google OAuth. On `local` the app is never gated here.
export function LoginScreen() {
  const { sendSignInLink, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendSignInLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--color-paper)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-ink)]">
            Tour Hub
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--color-ink-3)] leading-relaxed">
            Sign in to load your tour on any device.
          </p>
        </div>

        <div className="rounded-[6px] border border-[var(--color-rule)] bg-[var(--color-card)] shadow-sm p-5">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-paper-2)] text-[var(--color-ink-2)] mb-3">
                <Icon.Message size={18} />
              </div>
              <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">Check your email</p>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-3)] leading-relaxed">
                We sent a sign-in link to <span className="font-medium text-[var(--color-ink-2)]">{email}</span>.
                Open it on this device to continue.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-4 text-[12px] font-medium text-[var(--color-ink-3)] hover:text-[var(--color-ink)] underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={onEmailSubmit} className="space-y-2.5">
                <label className="block">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--color-ink-3)]">
                    Email
                  </span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@tour.com"
                    className="mt-1.5 w-full h-10 px-3 text-[13.5px] rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-4)] focus:outline-none focus:border-[var(--color-ink-4)]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-[4px] bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-ink-2)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </form>

              <div className="flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-[var(--color-rule-soft)]" />
                <span className="text-[11px] text-[var(--color-ink-4)]">or</span>
                <span className="flex-1 h-px bg-[var(--color-rule-soft)]" />
              </div>

              <button
                type="button"
                onClick={onGoogle}
                disabled={busy}
                className="w-full h-10 inline-flex items-center justify-center gap-2 text-[13px] font-semibold rounded-[4px] border border-[var(--color-rule)] bg-[var(--color-card)] text-[var(--color-ink)] hover:border-[var(--color-ink-4)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {error && (
            <p className="mt-3 text-[12px] text-[var(--color-accent)] leading-snug">{error}</p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--color-ink-4)] leading-relaxed">
          We email you a one-time link — no password to remember.
        </p>
      </div>
    </div>
  );
}
