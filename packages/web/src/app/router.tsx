import { lazy, type ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import type { Permission } from '@hbk/shared';
import { Needs, SignedIn } from './guards';

const Login = lazy(() => import('../features/auth/Login'));
const AuthCallback = lazy(() => import('../features/auth/AuthCallback'));
const Profile = lazy(() => import('../features/users/Profile'));
const Users = lazy(() => import('../features/users/Users'));
const Settings = lazy(() => import('../features/settings/Settings'));
const Clients = lazy(() => import('../features/clients/Clients'));
const Quotes = lazy(() => import('../features/quotes/Quotes'));
const QuoteForm = lazy(() => import('../features/quotes/QuoteForm'));
const QuoteDetail = lazy(() => import('../features/quotes/QuoteDetail'));
const Invoices = lazy(() => import('../features/invoices/Invoices'));
const InvoiceForm = lazy(() => import('../features/invoices/InvoiceForm'));
const InvoiceDetail = lazy(() => import('../features/invoices/InvoiceDetail'));

const guarded = (any: Permission[], page: ReactNode) => <Needs any={any}>{page}</Needs>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: <SignedIn />,
    children: [
      { path: '/', element: <Profile /> },
      { path: '/profile', element: <Profile /> },
      { path: '/users', element: guarded(['users.manage'], <Users />) },
      { path: '/settings', element: guarded(['settings.manage'], <Settings />) },
      { path: '/clients', element: guarded(['clients.view'], <Clients />) },
      { path: '/quotes', element: guarded(['quotes.view'], <Quotes />) },
      { path: '/quotes/new', element: guarded(['quotes.manage'], <QuoteForm />) },
      { path: '/quotes/:id', element: guarded(['quotes.view'], <QuoteDetail />) },
      { path: '/quotes/:id/edit', element: guarded(['quotes.manage'], <QuoteForm />) },
      { path: '/invoices', element: guarded(['invoices.view'], <Invoices />) },
      { path: '/invoices/new', element: guarded(['invoices.manage'], <InvoiceForm />) },
      { path: '/invoices/:id', element: guarded(['invoices.view'], <InvoiceDetail />) },
      { path: '/invoices/:id/edit', element: guarded(['invoices.manage'], <InvoiceForm />) },
      // Old bookmarks and mistyped addresses go home instead of showing a blank page.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
