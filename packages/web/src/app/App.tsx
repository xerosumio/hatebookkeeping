import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../shared/auth';
import { Loading } from '../shared/components/ui';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (failures, error) => {
        // Only retry when the server could not be reached; an answer (403, 404, …) is final.
        const answered = typeof error === 'object' && error !== null && 'response' in error && error.response;
        return !answered && failures < 2;
      },
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}
