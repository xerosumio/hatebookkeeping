import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { createApiRequest } from './client.js';

export interface McpHttpHandlerOptions {
  apiBaseUrl: string;
}

const SERVER_INSTRUCTIONS = `You are interacting with HateBookkeeping, a financial management system for small businesses.

CRITICAL RULES:
- All monetary amounts are in CENTS (smallest currency unit). HK$520 = 52000 cents. Always multiply display amounts by 100.
- Use get_settings to discover valid income/expense categories before creating transactions or recurring items.
- Use list_entities to discover available entities (companies) and their IDs.
- When creating invoices or quotations, you must compute subtotal and total from line items yourself.
- Line item unitPrice and amount fields are also in cents.
- For recurring income items, the "client" field is REQUIRED.
- For recurring expense items, the "payee" field is recommended.
- Update tools use PATCH (partial update) — only send fields you want to change.
- Approval workflows (quotations, payment requests, monthly close) require admin privileges.`;

export function createMcpHttpHandler(opts: McpHttpHandlerOptions) {
  return {
    async handlePost(req: { headers: Record<string, string | string[] | undefined>; body: unknown }, res: any) {
      const authHeader = req.headers.authorization;
      const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (!authStr?.startsWith('Bearer ')) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Missing or invalid Authorization header' },
          id: null,
        });
        return;
      }

      const token = authStr.slice(7);

      try {
        const server = new McpServer({
          name: 'hatebookkeeping',
          version: '2.0.0',
          description: SERVER_INSTRUCTIONS,
        });

        const apiRequestFn = createApiRequest(token, opts.apiBaseUrl);
        registerTools(server, apiRequestFn);
        registerPrompts(server);
        registerResources(server, apiRequestFn);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        await server.connect(transport);
        await transport.handleRequest(req as any, res, req.body);

        res.on('close', () => {
          transport.close();
          server.close();
        });
      } catch (error) {
        console.error('[mcp] Error handling request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    },

    handleMethodNotAllowed(_req: any, res: any) {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
    },
  };
}
