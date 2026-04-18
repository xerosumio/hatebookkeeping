import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { Client, Quotation } from '../types';

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

export function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<{ path: string }>('/uploads', formData).then((r) => r.data.path);
}
