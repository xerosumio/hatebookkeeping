import { lazy, type ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import type { Permission } from '@hbk/shared';
import { Needs, SignedIn } from './guards';

const Login = lazy(() => import('../features/auth/Login'));
const AuthCallback = lazy(() => import('../features/auth/AuthCallback'));
const Profile = lazy(() => import('../features/users/Profile'));
const Users = lazy(() => import('../features/users/Users'));
const Settings = lazy(() => import('../features/settings/Settings'));

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
      // Old bookmarks and mistyped addresses go home instead of showing a blank page.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
