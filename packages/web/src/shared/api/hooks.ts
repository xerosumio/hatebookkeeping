import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api, failureOf, type ApiFailure } from './client';

type Params = Record<string, string | number | boolean | undefined | null>;

function cleaned(params?: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') out[key] = String(value);
  }
  return out;
}

/** Reads one thing from the API. The path and its parameters are the cache key. */
export function useGet<T>(path: string | null, params?: Params): UseQueryResult<T> {
  const query = cleaned(params);
  return useQuery<T>({
    queryKey: [path, query],
    queryFn: async () => (await api.get<T>(path as string, { params: query })).data,
    enabled: path !== null,
  });
}

export interface Saver<TInput, TResult> {
  run: (input: TInput) => Promise<TResult | undefined>;
  busy: boolean;
  failure: ApiFailure | null;
  clear: () => void;
}

/**
 * Runs a change against the API. On success every list and figure on screen
 * is refetched, so nothing shows an old number. On failure the message and
 * the per-field errors are kept for the form to show.
 */
export function useSave<TInput = void, TResult = unknown>(
  action: (input: TInput) => Promise<TResult>,
  onDone?: (result: TResult) => void,
): Saver<TInput, TResult> {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const run = useCallback(
    async (input: TInput) => {
      setBusy(true);
      setFailure(null);
      try {
        const result = await action(input);
        await queryClient.invalidateQueries();
        onDone?.(result);
        return result;
      } catch (error) {
        setFailure(failureOf(error));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [action, onDone, queryClient],
  );

  const clear = useCallback(() => setFailure(null), []);
  return { run, busy, failure, clear };
}

export const post = async <T>(path: string, body?: unknown) => (await api.post<T>(path, body)).data;
export const put = async <T>(path: string, body?: unknown) => (await api.put<T>(path, body)).data;
export const del = async <T>(path: string) => (await api.delete<T>(path)).data;
