import type { RequestHandler } from 'express';
import type { Config } from '../config/env.js';

const ALLOWED_METHODS = 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'content-type,authorization,x-request-id';

/**
 * Reflect a matching Origin and answer preflight. Requests with no Origin
 * (curl, MCP, health checks) pass through unchanged.
 */
export function corsForWebOrigin(cfg: Config): RequestHandler {
  const allowed = cfg.webOrigin;

  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] ?? ALLOWED_HEADERS,
      );
      res.setHeader('Access-Control-Max-Age', '600');
      res.vary('Origin');
    }

    const isCorsPreflight =
      req.method === 'OPTIONS' && typeof req.headers['access-control-request-method'] === 'string';
    if (isCorsPreflight) {
      res.status(origin === allowed ? 204 : 403).end();
      return;
    }

    next();
  };
}

/**
 * Where to send the browser after OIDC. Only a same-web-origin path or an
 * absolute URL on WEB_ORIGIN is accepted, so this cannot be turned into an
 * open redirect.
 */
export function resolveReturnTo(raw: unknown, webOrigin: string): string {
  const fallback = new URL('/', webOrigin).toString();
  if (typeof raw !== 'string' || raw.length === 0) return fallback;

  if (isSafeReturnPath(raw)) {
    return new URL(raw, webOrigin).toString();
  }

  try {
    const url = new URL(raw);
    if (url.origin === new URL(webOrigin).origin) return url.toString();
  } catch {
    // Not a URL.
  }

  return fallback;
}

function isSafeReturnPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}
