import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

/**
 * Configuration is validated once, at boot, and the process refuses to start if
 * anything is wrong. A books app that comes up with a missing session secret
 * does more damage than one that never came up.
 */

const Secret = (name: string) =>
  z
    .string()
    .min(32, `${name} must be at least 32 characters. Generate one with: openssl rand -base64 48`);

function originOf(url: string): string {
  return new URL(url).origin;
}

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    PUBLIC_URL: z.string().url(),
    WEB_ORIGIN: z.string().url().optional(),

    MONGODB_URI: z.string().min(1).optional(),
    MONGO_URL: z.string().min(1).optional(),

    UPLOAD_DIR: z.string().default('./uploads'),

    OIDC_ISSUER: z.string().url(),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    OIDC_SCOPES: z.string().default('openid profile email'),
    OIDC_ADMIN_GROUP: z.string().default(''),

    SESSION_SECRET: Secret('SESSION_SECRET'),

    EMAIL_API_URL: z.string().optional().default(''),
    EMAIL_API_KEY: z.string().optional().default(''),

    AIRWALLEX_AX_CLIENT_ID: z.string().optional().default(''),
    AIRWALLEX_AX_API_KEY: z.string().optional().default(''),
    AIRWALLEX_AX_ACCOUNT_ID: z.string().optional().default(''),
    AIRWALLEX_NT_CLIENT_ID: z.string().optional().default(''),
    AIRWALLEX_NT_API_KEY: z.string().optional().default(''),
    AIRWALLEX_NT_ACCOUNT_ID: z.string().optional().default(''),
  })
  .superRefine((c, ctx) => {
    if (!c.MONGODB_URI && !c.MONGO_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['MONGODB_URI'],
        message: 'Set MONGODB_URI (or MONGO_URL).',
      });
    }
    if (c.NODE_ENV === 'production' && !c.WEB_ORIGIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message:
          'WEB_ORIGIN is required in production. Set it to the GitHub Pages origin if the SPA is hosted separately, or to the same value as PUBLIC_URL if this process serves the web app.',
      });
    }
  })
  .transform((c) => {
    const publicOrigin = originOf(c.PUBLIC_URL);
    const webOrigin = c.WEB_ORIGIN ? originOf(c.WEB_ORIGIN) : publicOrigin;
    const isProduction = c.NODE_ENV === 'production';
    const isSplitOrigin = webOrigin !== publicOrigin;
    const mongodbUri = (c.MONGODB_URI || c.MONGO_URL)!;
    return {
      NODE_ENV: c.NODE_ENV,
      PORT: c.PORT,
      PUBLIC_URL: publicOrigin,
      WEB_ORIGIN: webOrigin,
      OIDC_ISSUER: c.OIDC_ISSUER,
      OIDC_CLIENT_ID: c.OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET: c.OIDC_CLIENT_SECRET,
      OIDC_SCOPES: c.OIDC_SCOPES,
      OIDC_ADMIN_GROUP: c.OIDC_ADMIN_GROUP,
      SESSION_SECRET: c.SESSION_SECRET,
      UPLOAD_DIR: c.UPLOAD_DIR,
      EMAIL_API_URL: c.EMAIL_API_URL,
      EMAIL_API_KEY: c.EMAIL_API_KEY,
      AIRWALLEX_AX_CLIENT_ID: c.AIRWALLEX_AX_CLIENT_ID,
      AIRWALLEX_AX_API_KEY: c.AIRWALLEX_AX_API_KEY,
      AIRWALLEX_AX_ACCOUNT_ID: c.AIRWALLEX_AX_ACCOUNT_ID,
      AIRWALLEX_NT_CLIENT_ID: c.AIRWALLEX_NT_CLIENT_ID,
      AIRWALLEX_NT_API_KEY: c.AIRWALLEX_NT_API_KEY,
      AIRWALLEX_NT_ACCOUNT_ID: c.AIRWALLEX_NT_ACCOUNT_ID,
      isProduction,
      isSplitOrigin,
      webOrigin,
      mongodbUri,
      // Compat aliases used across existing routes.
      port: c.PORT,
      nodeEnv: c.NODE_ENV,
      frontendUrl: webOrigin,
      uploadDir: c.UPLOAD_DIR,
      emailApiUrl: c.EMAIL_API_URL,
      emailApiKey: c.EMAIL_API_KEY,
      airwallexAxClientId: c.AIRWALLEX_AX_CLIENT_ID,
      airwallexAxApiKey: c.AIRWALLEX_AX_API_KEY,
      airwallexAxAccountId: c.AIRWALLEX_AX_ACCOUNT_ID,
      airwallexNtClientId: c.AIRWALLEX_NT_CLIENT_ID,
      airwallexNtApiKey: c.AIRWALLEX_NT_API_KEY,
      airwallexNtAccountId: c.AIRWALLEX_NT_ACCOUNT_ID,
    };
  });

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`Invalid configuration:\n${issues}`);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}

/** Back-compat for existing `import { env } from './config/env.js'`. */
export const env: Config = new Proxy({} as Config, {
  get(_target, prop) {
    return getConfig()[prop as keyof Config];
  },
});
