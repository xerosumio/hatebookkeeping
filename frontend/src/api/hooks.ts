import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type {
  Client, Quotation, Invoice, Receipt, Transaction, Payee, PaymentRequest, RecurringItem,
  Settings, CashFlowReport, AccountsReceivableReport, IncomeStatementReport, AccountsPayableReport,
  User, Reimbursement, Entity, Shareholder, ShareLiabilityEntry, EquityTransaction, MonthlyClose, Fund, FundTransfer,
} from '../types';

// Users (admin-only)
interface UserFromApi { _id: string; email: string; name: string; role: string; active: boolean; bankName?: string; bankAccountNumber?: string; fpsPhone?: string; createdAt: string }
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserFromApi[]>('/users').then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string; role: string }) =>
      api.post('/auth/register', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; email?: string; role?: string; active?: boolean; password?: string; bankName?: string; bankAccountNumber?: string; fpsPhone?: string } }) =>
      api.put(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// Clients
export function useClients(filters?: { search?: string; entity?: string }) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => api.get<Client[]>('/clients', { params: filters }).then((r) => r.data),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => api.get<Client>(`/clients/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Client>) => api.post<Client>('/clients', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      api.put<Client>(`/clients/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// Quotations
export function useQuotations(filters?: { status?: string; client?: string; entity?: string }) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => api.get<Quotation[]>('/quotations', { params: filters }).then((r) => r.data),
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: ['quotations', id],
    queryFn: () => api.get<Quotation>(`/quotations/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Quotation>) =>
      api.post<Quotation>('/quotations', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Quotation> }) =>
      api.put<Quotation>(`/quotations/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useUpdateQuotationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/quotations/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useApproveQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/quotations/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useRejectQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/quotations/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useNotifyQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.post(`/quotations/${id}/notify`, { emails }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

// Invoices
export function useInvoices(filters?: { status?: string; client?: string; entity?: string }) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => api.get<Invoice[]>('/invoices', { params: filters }).then((r) => r.data),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Invoice>) =>
      api.post<Invoice>('/invoices', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Invoice> }) =>
      api.put<Invoice>(`/invoices/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string } }) =>
      api.patch<Invoice>(`/invoices/${id}/status`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useConvertQuotationToInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quotationId: string) =>
      api.post<Invoice[]>(`/invoices/from-quotation/${quotationId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
}

// Receipts
export function useReceipts(filters?: { entity?: string }) {
  return useQuery({
    queryKey: ['receipts', filters],
    queryFn: () => api.get<Receipt[]>('/receipts', { params: filters }).then((r) => r.data),
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: ['receipts', id],
    queryFn: () => api.get<Receipt>(`/receipts/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Receipt>) =>
      api.post<Receipt>('/receipts', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

// Transactions
export function useTransactions(filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.get<Transaction[]>('/transactions', { params: filters }).then((r) => r.data),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      api.post<Transaction>('/transactions', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['funds'] }); },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['funds'] }); },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['funds'] }); },
  });
}

// Payees
export function usePayees(filters?: { entity?: string }) {
  return useQuery({
    queryKey: ['payees', filters],
    queryFn: () => api.get<Payee[]>('/payees', { params: filters }).then((r) => r.data),
  });
}

export function useCreatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Payee>) =>
      api.post<Payee>('/payees', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  });
}

export function useUpdatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payee> }) =>
      api.put<Payee>(`/payees/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  });
}

export function useDeletePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  });
}

// Payment Requests
export function usePaymentRequests(filters?: { status?: string; entity?: string }) {
  return useQuery({
    queryKey: ['paymentRequests', filters],
    queryFn: () => api.get<PaymentRequest[]>('/payment-requests', { params: filters }).then((r) => r.data),
  });
}

export function usePaymentRequest(id: string) {
  return useQuery({
    queryKey: ['paymentRequests', id],
    queryFn: () => api.get<PaymentRequest>(`/payment-requests/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreatePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PaymentRequest>) =>
      api.post<PaymentRequest>('/payment-requests', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useUpdatePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put<PaymentRequest>(`/payment-requests/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useDeletePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payment-requests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useNotifyPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.post(`/payment-requests/${id}/notify`, { emails }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useApprovePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/payment-requests/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useRejectPaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/payment-requests/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['paymentRequests'] }),
  });
}

export function useExecutePaymentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bankReference }: { id: string; bankReference?: string }) =>
      api.patch(`/payment-requests/${id}/execute`, { bankReference }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentRequests'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// Recurring Items
export function useRecurringItems(filters?: { entity?: string }) {
  return useQuery({
    queryKey: ['recurring', filters],
    queryFn: () => api.get<RecurringItem[]>('/recurring', { params: filters }).then((r) => r.data),
  });
}

export function useCreateRecurringItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<RecurringItem>) =>
      api.post<RecurringItem>('/recurring', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useUpdateRecurringItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringItem> }) =>
      api.put<RecurringItem>(`/recurring/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useDeleteRecurringItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useGenerateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/recurring/generate').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['paymentRequests'] });
    },
  });
}

export function useGenerateRecurringInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ invoiceId: string; invoiceNumber: string }>(`/recurring/${id}/generate-invoice`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// Settings
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings').then((r) => r.data),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Settings>) =>
      api.put<Settings>('/settings', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// Reports
export function useCashFlow(year: number, entity?: string) {
  return useQuery({
    queryKey: ['reports', 'cash-flow', year, entity],
    queryFn: () => api.get<CashFlowReport>('/reports/cash-flow', { params: { year, ...(entity ? { entity } : {}) } }).then((r) => r.data),
  });
}

export function useAccountsReceivable(startDate?: string, endDate?: string, entity?: string) {
  return useQuery({
    queryKey: ['reports', 'accounts-receivable', startDate, endDate, entity],
    queryFn: () => api.get<AccountsReceivableReport>('/reports/accounts-receivable', {
      params: { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(entity ? { entity } : {}) },
    }).then((r) => r.data),
  });
}

export function useAccountsPayable(startDate?: string, endDate?: string, entity?: string) {
  return useQuery({
    queryKey: ['reports', 'accounts-payable', startDate, endDate, entity],
    queryFn: () => api.get<AccountsPayableReport>('/reports/accounts-payable', {
      params: { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(entity ? { entity } : {}) },
    }).then((r) => r.data),
  });
}

export function useRecurringOverview() {
  return useQuery({
    queryKey: ['reports', 'recurring-overview'],
    queryFn: () => api.get('/reports/recurring-overview').then((r) => r.data),
  });
}

export function useIncomeStatement(startDate?: string, endDate?: string, entity?: string) {
  return useQuery({
    queryKey: ['reports', 'income-statement', startDate, endDate, entity],
    queryFn: () =>
      api.get<IncomeStatementReport>('/reports/income-statement', { params: { startDate, endDate, ...(entity ? { entity } : {}) } }).then((r) => r.data),
  });
}

export function useIncomeStatementTransactions(
  type: string, category: string, startDate?: string, endDate?: string, enabled = false, entity?: string,
) {
  return useQuery({
    queryKey: ['reports', 'income-statement-txns', type, category, startDate, endDate, entity],
    queryFn: () =>
      api.get<Transaction[]>('/reports/income-statement/transactions', {
        params: { type, category, startDate, endDate, ...(entity ? { entity } : {}) },
      }).then((r) => r.data),
    enabled,
  });
}

// Reimbursements
export function useReimbursements() {
  return useQuery({
    queryKey: ['reimbursements'],
    queryFn: () => api.get<Reimbursement[]>('/reimbursements').then((r) => r.data),
  });
}

export function useReimbursement(id: string) {
  return useQuery({
    queryKey: ['reimbursements', id],
    queryFn: () => api.get<Reimbursement>(`/reimbursements/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; onBehalfOfUserId?: string; items: any[]; notes?: string }) =>
      api.post<Reimbursement>('/reimbursements', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] });
      qc.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}

export function useUpdateReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put<Reimbursement>(`/reimbursements/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] });
      qc.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}

export function useDeleteReimbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reimbursements/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] });
      qc.invalidateQueries({ queryKey: ['payment-requests'] });
    },
  });
}

// Entities
export function useEntities() {
  return useQuery({
    queryKey: ['entities'],
    queryFn: () => api.get<Entity[]>('/entities').then((r) => r.data),
  });
}

export function useEntity(id: string) {
  return useQuery({
    queryKey: ['entities', id],
    queryFn: () => api.get<Entity>(`/entities/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Entity>) =>
      api.post<Entity>('/entities', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entities'] }),
  });
}

export function useUpdateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entity> }) =>
      api.put<Entity>(`/entities/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entities'] }),
  });
}

// Shareholders
export function useShareholders() {
  return useQuery({
    queryKey: ['shareholders'],
    queryFn: () => api.get<Shareholder[]>('/shareholders').then((r) => r.data),
  });
}

export function useShareholder(id: string) {
  return useQuery({
    queryKey: ['shareholders', id],
    queryFn: () => api.get<{ shareholder: Shareholder; transactions: EquityTransaction[] }>(`/shareholders/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useShareholderSummary() {
  return useQuery({
    queryKey: ['shareholders', 'summary'],
    queryFn: () => api.get('/shareholders/summary').then((r) => r.data),
  });
}

export function useCreateShareholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { user: string; name: string; sharePercent: number }) =>
      api.post<Shareholder>('/shareholders', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholders'] }),
  });
}

export function useUpdateShareholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; sharePercent?: number; active?: boolean; reason?: string };
    }) => api.put<Shareholder>(`/shareholders/${id}`, data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['shareholders'] });
      qc.invalidateQueries({ queryKey: ['shareholders', variables.id] });
    },
  });
}

export function useShareTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { from: string; to: string; percent: number; reason?: string }) =>
      api.post('/shareholders/transfer', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shareholders'] });
    },
  });
}

export function useInvestShareholder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; date: string; description?: string } }) =>
      api.post(`/shareholders/${id}/invest`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shareholders'] }),
  });
}

export function useShareholderLiabilities(id: string) {
  return useQuery({
    queryKey: ['shareholders', id, 'liabilities'],
    queryFn: () => api.get<ShareLiabilityEntry[]>(`/shareholders/${id}/liabilities`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateShareholderLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { type: string; amount: number; date: string; description?: string } }) =>
      api.post(`/shareholders/${id}/liabilities`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shareholders'] });
    },
  });
}

export function useUpdateShareholderLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareholderId, entryId, data }: { shareholderId: string; entryId: string; data: { amount?: number; date?: string; description?: string } }) =>
      api.put(`/shareholders/${shareholderId}/liabilities/${entryId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shareholders'] });
    },
  });
}

export function useDeleteShareholderLiability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareholderId, entryId }: { shareholderId: string; entryId: string }) =>
      api.delete(`/shareholders/${shareholderId}/liabilities/${entryId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shareholders'] });
    },
  });
}

// Monthly Close
export function useMonthlyCloses(entity?: string) {
  return useQuery({
    queryKey: ['monthlyClose', entity],
    queryFn: () => api.get<MonthlyClose[]>('/monthly-close', { params: { ...(entity ? { entity } : {}) } }).then((r) => r.data),
  });
}

export function useMonthlyClose(entity: string, year: number, month: number) {
  return useQuery({
    queryKey: ['monthlyClose', entity, year, month],
    queryFn: () => api.get<MonthlyClose>(`/monthly-close/${entity}/${year}/${month}`).then((r) => r.data),
    enabled: !!entity && year > 0 && month > 0,
  });
}

export function usePreviewMonthlyClose() {
  return useMutation({
    mutationFn: ({ entity, year, month }: { entity: string; year: number; month: number }) =>
      api.post<MonthlyClose>(`/monthly-close/${entity}/${year}/${month}/preview`).then((r) => r.data),
  });
}

export function useFinalizeMonthlyClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, year, month, notes }: { entity: string; year: number; month: number; notes?: string }) =>
      api.post<MonthlyClose>(`/monthly-close/${entity}/${year}/${month}/finalize`, { notes }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthlyClose'] });
      qc.invalidateQueries({ queryKey: ['shareholders'] });
    },
  });
}

export function useCreateCollectionRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, year, month }: { entity: string; year: number; month: number }) =>
      api.post(`/monthly-close/${entity}/${year}/${month}/create-collection-requests`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paymentRequests'] });
    },
  });
}

// Funds
export function useFunds() {
  return useQuery({
    queryKey: ['funds'],
    queryFn: () => api.get<Fund[]>('/funds').then((r) => r.data),
  });
}

export function useCreateFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: string; entity?: string; heldIn?: string; openingBalance?: number; balance?: number }) =>
      api.post<Fund>('/funds', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  });
}

export function useUpdateFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; type?: string; entity?: string | null; heldIn?: string | null; openingBalance?: number; balance?: number; active?: boolean } }) =>
      api.put<Fund>(`/funds/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  });
}

export function useDeleteFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/funds/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  });
}

export function useFundTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fromFund?: string; toFund?: string; amount: number; date: string; description: string; reference?: string }) =>
      api.post<FundTransfer>('/funds/transfer', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funds'] });
      qc.invalidateQueries({ queryKey: ['fundTransfers'] });
    },
  });
}

export function useFundTransactions(fundId: string) {
  return useQuery({
    queryKey: ['fundTransfers', fundId],
    queryFn: () => api.get<FundTransfer[]>(`/funds/${fundId}/transactions`).then((r) => r.data),
    enabled: !!fundId,
  });
}

export async function fetchPdfBlob(url: string): Promise<string> {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

export function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ path: string }>('/uploads', formData).then((r) => r.data.path);
}
