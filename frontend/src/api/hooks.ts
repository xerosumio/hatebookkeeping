import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { Client, Quotation, Invoice, Receipt, Transaction, PaymentRequest, RecurringItem } from '../types';

// Clients
export function useClients(search?: string) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: () => api.get<Client[]>('/clients', { params: { search } }).then((r) => r.data),
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
export function useQuotations(filters?: { status?: string; client?: string }) {
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

// Invoices
export function useInvoices(filters?: { status?: string; client?: string }) {
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
export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: () => api.get<Receipt[]>('/receipts').then((r) => r.data),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

// Payment Requests
export function usePaymentRequests(filters?: { status?: string }) {
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
export function useRecurringItems() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.get<RecurringItem[]>('/recurring').then((r) => r.data),
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
    },
  });
}

// Reports
export function useCashFlow(year: number) {
  return useQuery({
    queryKey: ['reports', 'cash-flow', year],
    queryFn: () => api.get('/reports/cash-flow', { params: { year } }).then((r) => r.data),
  });
}

export function useAccountsReceivable() {
  return useQuery({
    queryKey: ['reports', 'accounts-receivable'],
    queryFn: () => api.get('/reports/accounts-receivable').then((r) => r.data),
  });
}

export function useRecurringOverview() {
  return useQuery({
    queryKey: ['reports', 'recurring-overview'],
    queryFn: () => api.get('/reports/recurring-overview').then((r) => r.data),
  });
}

export function useIncomeStatement(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['reports', 'income-statement', startDate, endDate],
    queryFn: () =>
      api.get('/reports/income-statement', { params: { startDate, endDate } }).then((r) => r.data),
  });
}

export function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ path: string }>('/uploads', formData).then((r) => r.data.path);
}
