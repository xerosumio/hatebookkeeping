import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, failureOf } from '../../shared/api/client';
import { safeReturnPath, setWebToken } from '../../shared/api/session';
import { Loading, Notice } from '../../shared/components/ui';

/** Where the API sends the browser after sign-in: with a one-time ticket, or with the reason it failed. */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const ticket = params.get('ticket');
  const failed = params.get('error');
  const [error, setError] = useState<string | null>(failed ?? (ticket ? null : 'The sign-in link is incomplete. Start again.'));
  const started = useRef(false);

  useEffect(() => {
    // A ticket works once; this guard stops React's double effect run from spending it twice.
    if (!ticket || failed || started.current) return;
    started.current = true;
    api
      .post<{ token: string; returnTo: string }>('/auth/complete', { ticket })
      .then((response) => {
        setWebToken(response.data.token);
        window.location.replace(safeReturnPath(response.data.returnTo));
      })
      .catch((err: unknown) => setError(failureOf(err).message));
  }, [ticket, failed]);

  return (
    <div className="floor-grid flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-hair bg-panel p-8 lift">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-ink">Sign-in did not finish</h1>
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
            <Link to="/login" className="mt-4 inline-block text-sm text-human underline">
              Try again
            </Link>
          </>
        ) : (
          <Loading label="Signing you in…" />
        )}
      </div>
    </div>
  );
}
