import type { Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import type { z } from 'zod';
import { validate } from '@hbk/shared';
import { notFound, validationError } from './errors.js';

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function route(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

/** Validates a request body against a shared schema, or throws a 400 naming each bad field. */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = validate(schema, input ?? {});
  if (!result.ok) throw validationError(result.fields);
  return result.value;
}

export function objectId(value: unknown, what = 'That record'): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value) || value.length !== 24) throw notFound(what);
  return new Types.ObjectId(value);
}

export function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function idOf(value: unknown): string {
  return String(value);
}
