import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { parseMoney, validate, type FieldErrors } from '@hbk/shared';
import { failureOf } from './api/client';

export interface FormSave {
  submit: () => Promise<void>;
  busy: boolean;
  /** Messages keyed by field path, e.g. `lineItems.0.description`. */
  errors: FieldErrors;
  /** A message that is not about one field (or the first field message, as a summary). */
  message: string | null;
  clear: () => void;
}

/**
 * Saves a form. The values are checked in the browser with the same schema
 * the server uses, so the messages match; the server still checks everything
 * again and its answer wins.
 */
export function useFormSave<S extends z.ZodTypeAny, TResult>(
  schema: S,
  build: () => unknown,
  send: (value: z.output<S>) => Promise<TResult>,
  onDone: (result: TResult) => void,
): FormSave {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const checked = validate(schema, build());
    if (!checked.ok) {
      setErrors(checked.fields);
      setMessage('Some fields need attention.');
      return;
    }
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await send(checked.value);
      await queryClient.invalidateQueries();
      onDone(result);
    } catch (error) {
      const failure = failureOf(error);
      setErrors(failure.fields);
      setMessage(failure.message);
    } finally {
      setBusy(false);
    }
  }, [schema, build, send, onDone, queryClient]);

  const clear = useCallback(() => {
    setErrors({});
    setMessage(null);
  }, []);

  return { submit, busy, errors, message, clear };
}

/** Typed money text to cents. Unreadable text becomes NaN, which the schema reports against the field. */
export const centsOf = (text: string): number => parseMoney(text) ?? Number.NaN;

/** Typed number text to a number; empty or unreadable becomes NaN. */
export const numberOf = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
