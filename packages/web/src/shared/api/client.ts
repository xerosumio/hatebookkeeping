import axios, { AxiosError } from 'axios';
import type { ApiErrorBody, FieldErrors } from '@hbk/shared';
import { apiUrl } from './base';
import { clearWebToken, getWebToken, shouldRedirectToLogin } from './session';

export const api = axios.create({ baseURL: apiUrl('') });

api.interceptors.request.use((request) => {
  const token = getWebToken();
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export function loginUrl(returnTo: string): string {
  return `${apiUrl('/auth/login')}?returnTo=${encodeURIComponent(returnTo)}`;
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    if (status === 401 && shouldRedirectToLogin(window.location.pathname)) {
      // The session ended (signed out elsewhere, expired, or switched off).
      clearWebToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export interface ApiFailure {
  message: string;
  fields: FieldErrors;
  status: number | null;
}

/** Turns whatever a request threw into a message a person can read. */
export function failureOf(error: unknown): ApiFailure {
  if (error instanceof AxiosError) {
    if (error.response) {
      const body = error.response.data as Partial<ApiErrorBody> | undefined;
      return {
        message: typeof body?.error === 'string' ? body.error : `The server answered ${error.response.status}.`,
        fields: body?.fields ?? {},
        status: error.response.status,
      };
    }
    return { message: 'Could not reach the server. Check your connection and try again.', fields: {}, status: null };
  }
  return { message: error instanceof Error ? error.message : 'Something went wrong.', fields: {}, status: null };
}

/** Fetches a protected file or PDF. They cannot be plain links because they need the sign-in token. */
export async function fetchBlob(path: string): Promise<Blob> {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  return response.data;
}
