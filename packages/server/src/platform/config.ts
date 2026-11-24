import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

/**
 * Configuration is validated once, at boot. The process refuses to start on a
 * bad configuration rather than failing later against real books.
 */

const secret = (name: string) =>
  z.string().min(32, `${name} must be at least 32 characters. Generate one with: openssl rand -base64 48`);

function originOf(url: string): string {
  return new URL(url).origin;
}

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    PUBLIC_URL: z.string().url(),
    WEB_ORIGIN: z.string().url().optional(),

    MONGODB_URI: z.string().min(1).optional(),
    MONGO_URL: z.string().min(1).optional(),

    OIDC_ISSUER: z.string().url(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    OIDC_SCOPES: z.string().default('openid profile email'),
    OIDC_ADMIN_GROUP: z.string().default(''),

    SESSION_SECRET: secret('SESSION_SECRET'),

    EMAIL_API_URL: z.string().optional().default(''),
    EMAIL_API_KEY: z.string().optional().default(''),
  })
  .superRefine((c, ctx) => {
    if (!c.MONGODB_URI && !c.MONGO_URL) {
      ctx.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'Set MONGODB_URI (or MONGO_URL).' });
    }
    if (c.NODE_ENV === 'production' && !c.WEB_ORIGIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'WEB_ORIGIN is required in production. Set it to the origin the web app is served from.',
      });
    }
    if (c.NODE_ENV === 'production' && new URL(c.OIDC_ISSUER).protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', path: ['OIDC_ISSUER'], message: 'OIDC_ISSUER must be https in production.' });
    }
  })
  .transform((c) => ({
    nodeEnv: c.NODE_ENV,
    isProduction: c.NODE_ENV === 'production',
    port: c.PORT,
    publicUrl: originOf(c.PUBLIC_URL),
    webOrigin: c.WEB_ORIGIN ? originOf(c.WEB_ORIGIN) : originOf(c.PUBLIC_URL),
    mongodbUri: (c.MONGODB_URI || c.MONGO_URL)!,
    oidcIssuer: c.OIDC_ISSUER,
    oidcClientId: c.OIDC_CLIENT_ID,
    oidcClientSecret: c.OIDC_CLIENT_SECRET,
    oidcScopes: c.OIDC_SCOPES,
    oidcAdminGroup: c.OIDC_ADMIN_GROUP.trim(),
    sessionSecret: c.SESSION_SECRET,
    emailApiUrl: c.EMAIL_API_URL.replace(/\/$/, ''),
    emailApiKey: c.EMAIL_API_KEY,
  }));

export type Config = z.output<typeof configSchema>;

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Invalid configuration:\n${issues}`);
  }
  return parsed.data;
}
