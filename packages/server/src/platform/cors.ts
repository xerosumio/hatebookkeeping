import type { RequestHandler } from 'express';

const ALLOWED_METHODS = 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'content-type,authorization';

/**
 * Reflects the web app's origin and answers preflight. Requests with no
 * Origin (curl, health checks) pass through unchanged.
 */
export function corsForWebOrigin(webOrigin: string): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === webOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? ALLOWED_HEADERS);
      res.setHeader('Access-Control-Expose-Headers', 'content-disposition');
      res.setHeader('Access-Control-Max-Age', '600');
      res.vary('Origin');
    }

    const isPreflight = req.method === 'OPTIONS' && typeof req.headers['access-control-request-method'] === 'string';
    if (isPreflight) {
      res.status(origin === webOrigin ? 204 : 403).end();
      return;
    }
    next();
  };
}

/**
 * Where to send the browser after sign-in. Only a path on the web origin, or
 * an absolute URL on it, is accepted, so this cannot become an open redirect.
 */
export function resolveReturnTo(raw: unknown, webOrigin: string): string {
  const fallback = new URL('/', webOrigin).toString();
  if (typeof raw !== 'string' || raw.length === 0) return fallback;

  const isSafePath =
    raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !/^[a-z][a-z0-9+.-]*:/i.test(raw);
  if (isSafePath) return new URL(raw, webOrigin).toString();

  try {
    const url = new URL(raw);
    if (url.origin === new URL(webOrigin).origin) return url.toString();
  } catch {
    // Not a URL.
  }
  return fallback;
}
