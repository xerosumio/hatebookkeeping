import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { fieldErrorsOf, type ApiErrorBody, type FieldErrors } from '@hbk/shared';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, `${what} was not found.`);
export const forbidden = (message = 'You do not have access to this.') => new AppError(403, message);
export const conflict = (message: string) => new AppError(409, message);
export const badRequest = (message: string, fields?: FieldErrors) => new AppError(400, message, fields);

export function validationError(fields: FieldErrors): AppError {
  const first = Object.values(fields)[0] ?? 'Some of what was entered is not valid.';
  return new AppError(400, first, fields);
}

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Every failure leaves the API as `{ error, fields? }`. Anything we did not
 * anticipate is logged and reported as a plain 500 without internals.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const send = (status: number, body: ApiErrorBody) => {
    res.status(status).json(body);
  };

  if (err instanceof AppError) {
    return send(err.status, err.fields ? { error: err.message, fields: err.fields } : { error: err.message });
  }
  if (err instanceof ZodError) {
    const appError = validationError(fieldErrorsOf(err));
    return send(400, { error: appError.message, fields: appError.fields });
  }
  if (err instanceof mongoose.Error.VersionError) {
    return send(409, { error: 'Someone else changed this just now. Reload the page and try again.' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return send(404, { error: 'That record was not found.' });
  }
  if (isDuplicateKey(err)) {
    return send(409, { error: 'That already exists.' });
  }
  if (err instanceof Error && err.name === 'MulterError') {
    const tooLarge = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
    return send(400, { error: tooLarge ? 'That file is larger than 5 MB.' : 'That upload could not be read.' });
  }
  if (isBodyParserError(err)) {
    if (err.type === 'entity.too.large') return send(413, { error: 'That request is too large.' });
    if (err.type === 'entity.parse.failed') return send(400, { error: 'The request body is not valid JSON.' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  send(500, { error: 'Something went wrong on the server. Nothing was saved.' });
};
