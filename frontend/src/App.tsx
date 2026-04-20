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
import InvoiceList from './pages/InvoiceList';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceDetail from './pages/InvoiceDetail';
import ReceiptList from './pages/ReceiptList';
import ReceiptDetail from './pages/ReceiptDetail';
import ReceiptForm from './pages/ReceiptForm';
import TransactionList from './pages/TransactionList';
import PayeeList from './pages/PayeeList';
import PaymentRequestList from './pages/PaymentRequestList';
import PaymentRequestDetail from './pages/PaymentRequestDetail';
import PaymentRequestForm from './pages/PaymentRequestForm';
import ReimbursementList from './pages/ReimbursementList';
import ReimbursementForm from './pages/ReimbursementForm';
import ReimbursementDetail from './pages/ReimbursementDetail';
import RecurringList from './pages/RecurringList';
import ShareholderList from './pages/ShareholderList';
import ShareholderDetail from './pages/ShareholderDetail';
import MonthlyCloseList from './pages/MonthlyCloseList';
import MonthlyCloseDetail from './pages/MonthlyCloseDetail';
import Reports from './pages/Reports';
import UserList from './pages/UserList';
import FundList from './pages/FundList';
import FundDetail from './pages/FundDetail';
import SettingsPage from './pages/Settings';
import AirwallexSync from './pages/AirwallexSync';
import Endpoint from './pages/Endpoint';

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
              <Route path="invoices" element={<InvoiceList />} />
              <Route path="invoices/new" element={<InvoiceForm />} />
              <Route path="invoices/:id" element={<InvoiceDetail />} />
              <Route path="invoices/:id/edit" element={<InvoiceForm />} />
              <Route path="receipts" element={<ReceiptList />} />
              <Route path="receipts/new" element={<ReceiptForm />} />
              <Route path="receipts/:id" element={<ReceiptDetail />} />
              <Route path="transactions" element={<TransactionList />} />
              <Route path="payees" element={<PayeeList />} />
              <Route path="payment-requests" element={<PaymentRequestList />} />
              <Route path="payment-requests/new" element={<PaymentRequestForm />} />
              <Route path="payment-requests/:id" element={<PaymentRequestDetail />} />
              <Route path="payment-requests/:id/edit" element={<PaymentRequestForm />} />
              <Route path="reimbursements" element={<ReimbursementList />} />
              <Route path="reimbursements/new" element={<ReimbursementForm />} />
              <Route path="reimbursements/:id" element={<ReimbursementDetail />} />
              <Route path="reimbursements/:id/edit" element={<ReimbursementForm />} />
              <Route path="recurring" element={<RecurringList />} />
              <Route path="shareholders" element={<ShareholderList />} />
              <Route path="shareholders/:id" element={<ShareholderDetail />} />
              <Route path="monthly-close" element={<MonthlyCloseList />} />
              <Route path="monthly-close/:entity/:year/:month" element={<MonthlyCloseDetail />} />
              <Route path="funds" element={<FundList />} />
              <Route path="funds/:id" element={<FundDetail />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<UserList />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="airwallex-sync" element={<AirwallexSync />} />
              <Route path="endpoint" element={<Endpoint />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
