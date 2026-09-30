import { Router } from 'express';
import { createMcpHttpHandler } from '../mcp/handler.js';
import { getConfig } from '../config/env.js';

const router = Router();

const handler = createMcpHttpHandler({
  apiBaseUrl: `http://127.0.0.1:${getConfig().port}/api`,
});

router.post('/', (req, res) => handler.handlePost(req, res));
router.get('/', (req, res) => handler.handleMethodNotAllowed(req, res));
router.delete('/', (req, res) => handler.handleMethodNotAllowed(req, res));

export default router;
