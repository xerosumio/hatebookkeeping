import { Router, urlencoded } from 'express';
import { createMcpHttpHandler } from '../mcp/handler.js';
import { env } from '../config/env.js';

const router = Router();

const handler = createMcpHttpHandler({
  apiBaseUrl: `http://localhost:${env.port}/api`,
});

router.post('/', (req, res) => handler.handlePost(req, res));
router.get('/', (req, res) => handler.handleMethodNotAllowed(req, res));
router.delete('/', (req, res) => handler.handleMethodNotAllowed(req, res));

// --- OAuth2 endpoints for Claude connector auth ---

router.get('/oauth/authorize', (req, res) => {
  const { redirect_uri, state } = req.query;
  if (!redirect_uri) {
    res.status(400).json({ error: 'missing redirect_uri' });
    return;
  }
  const url = new URL(redirect_uri as string);
  url.searchParams.set('code', 'unused');
  if (state) url.searchParams.set('state', state as string);
  res.redirect(url.toString());
});

router.post('/oauth/token', urlencoded({ extended: false }), (req, res) => {
  const secret = req.body.client_secret || req.body.code;
  if (!secret) {
    res.status(400).json({ error: 'invalid_request', error_description: 'client_secret is required' });
    return;
  }
  res.json({
    access_token: secret,
    token_type: 'bearer',
    expires_in: 31536000,
  });
});

router.get('/oauth/metadata', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(buildOAuthMetadata(base));
});

function buildOAuthMetadata(baseUrl: string) {
  const mcpBase = `${baseUrl}/api/mcp`;
  return {
    issuer: baseUrl,
    authorization_endpoint: `${mcpBase}/oauth/authorize`,
    token_endpoint: `${mcpBase}/oauth/token`,
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
  };
}

export { buildOAuthMetadata };
export default router;
