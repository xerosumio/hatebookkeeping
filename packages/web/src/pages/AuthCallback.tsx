import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { safeReturnPath, setWebToken } from '../api/session';

/**
 * One POST per ticket. React StrictMode remounts this page in development and
 * would otherwise consume the one-time ticket twice: the first response is
 * discarded, the second is "already used".
 */
const exchanges = new Map<string, Promise<{ token: string; returnTo: string }>>();

function exchangeTicket(ticket: string) {
  const existing = exchanges.get(ticket);
  if (existing) return existing;
  const pending = api
    .post<{ token: string; returnTo: string }>('/auth/complete', { ticket })
    .then((res) => res.data);
  exchanges.set(ticket, pending);
  pending.catch(() => {
    exchanges.delete(ticket);
  });
  return pending;
}

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ticket = searchParams.get('ticket');

  useEffect(() => {
    if (!ticket) {
      setError('This sign-in link is missing its ticket. Start again from the home page.');
      return;
    }

    let cancelled = false;
    void exchangeTicket(ticket)
      .then((result) => {
        setWebToken(result.token);
        if (cancelled) return;
        navigate(safeReturnPath(result.returnTo), { replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : undefined;
        setError(message || 'Sign-in did not finish.');
      });

    return () => {
      cancelled = true;
    };
  }, [ticket, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-surface-2)] p-8">
      <div
        className="max-w-md rounded-lg p-6"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow)' }}
      >
        {error ? (
          <>
            <h1 className="mb-1 text-base font-semibold">Could not finish signing in</h1>
            <p className="mb-4 text-sm text-[var(--color-ink-muted)]">{error}</p>
            <Link to="/login" className="text-sm font-medium text-[var(--color-accent)]">
              Try again
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-base font-semibold">Signing in</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">Finishing Authentik…</p>
          </>
        )}
      </div>
    </div>
  );
}
