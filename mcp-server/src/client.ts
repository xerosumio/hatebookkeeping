const API_URL = process.env.BOOKKEEPING_API_URL || 'http://localhost:4000/api';
const EMAIL = process.env.BOOKKEEPING_EMAIL || '';
const PASSWORD = process.env.BOOKKEEPING_PASSWORD || '';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function authenticate(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  if (!EMAIL || !PASSWORD) {
    throw new Error('BOOKKEEPING_EMAIL and BOOKKEEPING_PASSWORD env vars are required');
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // refresh 1h before 24h expiry
  return cachedToken!;
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<unknown> {
  const token = await authenticate();

  const url = new URL(`${API_URL}${path}`);
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
}
