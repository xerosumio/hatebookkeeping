#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';
import { apiRequest } from './client.js';

const server = new McpServer({
  name: 'hatebookkeeping',
  version: '1.0.0',
});

registerTools(server, apiRequest);

const transport = new StdioServerTransport();
await server.connect(transport);
