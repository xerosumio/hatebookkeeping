import { useSearchParams } from 'react-router-dom';
import { loginUrl } from '../../shared/api/client';
import { safeReturnPath } from '../../shared/api/session';
import { Button, Notice } from '../../shared/components/ui';

export default function Login() {
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('returnTo') ?? '/');
  const error = params.get('error');

  return (
    <div className="floor-grid flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-hair bg-panel p-8 lift">
        <img src="/favicon.svg" alt="" className="h-10 w-10" />
        <h1 className="mt-4 text-xl font-semibold text-ink">HateBookkeeping</h1>
        <p className="mt-1 text-sm text-ink-faint">Quotes, invoices, expenses, claims, salary and your monthly profit and loss.</p>
        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
        <Button
          variant="primary"
          className="mt-6 w-full"
          onClick={() => {
            window.location.href = loginUrl(`${window.location.origin}${returnTo}`);
          }}
        >
          Sign in with Naton
        </Button>
      </div>
    </div>
  );
}
