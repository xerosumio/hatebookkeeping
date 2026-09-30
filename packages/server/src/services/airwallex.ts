import { env } from '../config/env.js';

const BASE_URL = 'https://api.airwallex.com/api/v1';

interface TokenCache {
  token: string;
  expiresAt: number;
}

export interface AirwallexBalance {
  available_amount: number;
  currency: string;
  pending_amount: number;
  total_amount: number;
}

export type EntityKey = 'ax' | 'nt';

const credentials: Record<EntityKey, { clientId: string; apiKey: string; accountId: string }> = {
  ax: {
    clientId: env.airwallexAxClientId,
    apiKey: env.airwallexAxApiKey,
    accountId: env.airwallexAxAccountId,
  },
  nt: {
    clientId: env.airwallexNtClientId,
    apiKey: env.airwallexNtApiKey,
    accountId: env.airwallexNtAccountId,
  },
};

const tokenCache: Record<EntityKey, TokenCache | null> = { ax: null, nt: null };

async function authenticate(entity: EntityKey): Promise<string> {
  const cached = tokenCache[entity];
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const cred = credentials[entity];
  if (!cred.clientId || !cred.apiKey) {
    throw new Error(`Airwallex credentials not configured for ${entity}`);
  }

  const res = await fetch(`${BASE_URL}/authentication/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': cred.clientId,
      'x-api-key': cred.apiKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airwallex auth failed for ${entity}: ${res.status} ${body}`);
  }

  const data = await res.json() as { token: string; expires_at: string };
  tokenCache[entity] = {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime() - 60_000,
  };
  return data.token;
}

async function apiGet<T>(entity: EntityKey, path: string, params?: Record<string, string>): Promise<T> {
  const token = await authenticate(entity);
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airwallex GET ${path} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<T>;
}

export function resolveEntity(code: string): EntityKey {
  const lower = code.toLowerCase();
  if (lower === 'ax' || lower.startsWith('axilogy') || lower.startsWith('axi')) return 'ax';
  if (lower === 'nt' || lower.startsWith('naton')) return 'nt';
  throw new Error(`Unknown entity code: ${code}`);
}

export async function getBalances(entity: EntityKey): Promise<AirwallexBalance[]> {
  const data = await apiGet<AirwallexBalance[]>(entity, '/balances/current');
  return data;
}

export function getTokenStatus(): Record<EntityKey, { authenticated: boolean; expiresAt: number | null }> {
  return {
    ax: { authenticated: !!tokenCache.ax && tokenCache.ax.expiresAt > Date.now(), expiresAt: tokenCache.ax?.expiresAt ?? null },
    nt: { authenticated: !!tokenCache.nt && tokenCache.nt.expiresAt > Date.now(), expiresAt: tokenCache.nt?.expiresAt ?? null },
  };
}
