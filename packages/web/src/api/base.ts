const raw: unknown = import.meta.env.VITE_API_URL;
export const API_ORIGIN = (typeof raw === 'string' ? raw : '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const withApi = suffix === '/api' || suffix.startsWith('/api/') ? suffix : `/api${suffix}`;
  return `${API_ORIGIN}${withApi}`;
}
