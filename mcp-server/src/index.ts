#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { apiRequest } from './client.js';

const server = new McpServer({
  name: 'hatebookkeeping',
  version: '2.0.0',
  description: `HateBookkeeping financial management system. All amounts in CENTS (HK$520 = 52000). Use get_settings for valid categories. Update tools use PATCH (partial update).`,
});

registerTools(server, apiRequest);
registerPrompts(server);
registerResources(server, apiRequest);

const transport = new StdioServerTransport();
await server.connect(transport);
