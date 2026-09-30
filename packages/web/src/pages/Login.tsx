import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function Login() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-surface-2)] p-8">
      <div
        className="w-full max-w-sm rounded-lg p-8 text-center"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow)' }}
      >
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">HateBookkeeping</h1>
        <p className="mt-2 mb-6 text-sm text-[var(--color-ink-muted)]">
          Sign in with Authentik to continue.
        </p>
        <Button type="button" className="w-full" onClick={login}>
          Sign in with Authentik
        </Button>
      </div>
    </div>
  );
}
