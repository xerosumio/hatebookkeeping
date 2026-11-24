import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permission } from '@hbk/shared';
import { useAuth } from '../shared/auth';
import { getWebToken } from '../shared/api/session';
import { CompanyProvider } from '../shared/company';
import { Button, Loading, Notice } from '../shared/components/ui';
import { Layout } from './Layout';

/** Everything inside the app shell needs a signed-in person. */
export function SignedIn() {
  const { me, loading, problem } = useAuth();
  const location = useLocation();

  if (!getWebToken()) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={returnTo === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  if (loading) return <Loading />;
  if (!me) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8">
        <Notice tone="error">{problem ?? 'Could not load your account.'}</Notice>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }
  return (
    <CompanyProvider>
      <Layout />
    </CompanyProvider>
  );
}

/**
 * Hides a page from people whose role cannot use it. This is a courtesy: the
 * server makes the same check on every request and is the one that counts.
 */
export function Needs({ any, children }: { any: Permission[]; children: ReactNode }) {
  const { can } = useAuth();
  if (!any.some(can)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** The first page after sign-in: the dashboard, or their claims for staff. */
export function Home({ dashboard }: { dashboard: ReactNode }) {
  const { can } = useAuth();
  if (can('dashboard.view')) return <>{dashboard}</>;
  return <Navigate to="/claims" replace />;
}
