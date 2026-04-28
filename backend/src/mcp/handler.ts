import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';
import { createApiRequest } from './client.js';

export interface McpHttpHandlerOptions {
  apiBaseUrl: string;
}

/**
 * Creates Express-compatible request handlers for the MCP Streamable HTTP transport.
 * Each POST request creates a fresh stateless MCP server with tools authenticated
 * using the Bearer token from the incoming request.
 */
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
          version: '1.0.0',
        });

        const apiRequestFn = createApiRequest(token, opts.apiBaseUrl);
        registerTools(server, apiRequestFn);

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
