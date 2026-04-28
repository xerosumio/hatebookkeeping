export type ApiRequestFn = (
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
) => Promise<unknown>;

export function createApiRequest(token: string, baseUrl = 'http://localhost:4000/api'): ApiRequestFn {
  return async function apiRequest(method, path, body?, query?) {
    if (!token) {
      throw new Error('API token is required');
    }

    const url = new URL(`${baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
}

export const apiRequest: ApiRequestFn = createApiRequest(
  process.env.BOOKKEEPING_API_TOKEN || '',
  process.env.BOOKKEEPING_API_URL || 'http://localhost:4000/api',
);
