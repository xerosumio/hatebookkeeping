import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientForm from './pages/ClientForm';
import QuotationList from './pages/QuotationList';
import QuotationForm from './pages/QuotationForm';
import QuotationDetail from './pages/QuotationDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-gray-500">Coming soon.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="clients" element={<ClientList />} />
              <Route path="clients/new" element={<ClientForm />} />
              <Route path="clients/:id/edit" element={<ClientForm />} />
              <Route path="quotations" element={<QuotationList />} />
              <Route path="quotations/new" element={<QuotationForm />} />
              <Route path="quotations/:id" element={<QuotationDetail />} />
              <Route path="quotations/:id/edit" element={<QuotationForm />} />
              <Route path="invoices" element={<Placeholder title="Invoices" />} />
              <Route path="receipts" element={<Placeholder title="Receipts" />} />
              <Route path="transactions" element={<Placeholder title="Transactions" />} />
              <Route path="payment-requests" element={<Placeholder title="Payment Requests" />} />
              <Route path="recurring" element={<Placeholder title="Recurring" />} />
              <Route path="reports" element={<Placeholder title="Reports" />} />
              <Route path="settings" element={<Placeholder title="Settings" />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
