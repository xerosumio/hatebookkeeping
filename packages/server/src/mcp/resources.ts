import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiRequestFn } from './client.js';

export function registerResources(server: McpServer, api: ApiRequestFn) {

  server.resource('settings', 'hbk://settings', {
    description: 'Application settings including valid income/expense categories, default entity, and configuration',
    mimeType: 'application/json',
  }, async () => {
    try {
      const data = await api('GET', '/settings');
      return { contents: [{ uri: 'hbk://settings', text: JSON.stringify(data, null, 2), mimeType: 'application/json' }] };
    } catch {
      return { contents: [{ uri: 'hbk://settings', text: '{"error": "Failed to fetch settings"}', mimeType: 'application/json' }] };
    }
  });

  server.resource('entities', 'hbk://entities', {
    description: 'All entities (companies) with their codes, names, and IDs',
    mimeType: 'application/json',
  }, async () => {
    try {
      const data = await api('GET', '/entities');
      return { contents: [{ uri: 'hbk://entities', text: JSON.stringify(data, null, 2), mimeType: 'application/json' }] };
    } catch {
      return { contents: [{ uri: 'hbk://entities', text: '{"error": "Failed to fetch entities"}', mimeType: 'application/json' }] };
    }
  });

  server.resource('reference', 'hbk://reference', {
    description: 'Reference guide for using HateBookkeeping MCP tools correctly',
    mimeType: 'text/plain',
  }, async () => ({
    contents: [{
      uri: 'hbk://reference',
      text: `HateBookkeeping MCP Reference Guide
=====================================

AMOUNTS
-------
All monetary amounts in the API are in CENTS (smallest currency unit).
- HK$520.00 = 52000
- HK$1,234.56 = 123456
- Always multiply display amounts by 100 before sending to the API.
- Amounts returned by the API are also in cents — divide by 100 for display.

ENTITIES
--------
Entities are companies/business units. Common codes:
- Use list_entities to see all available entities and their IDs.
- Entity ID (MongoDB ObjectId) is required for most create operations.

CATEGORIES
----------
Income and expense categories are configurable per-entity.
- Call get_settings to see valid categories.
- Common income categories: "Revenue", "Other Income"
- Common expense categories: "Operating Expenses", "Professional Fees", etc.

LINE ITEMS (Invoices/Quotations)
---------------------------------
Line items must be a JSON string array. Each item needs:
- description: string
- quantity: positive number
- unitPrice: integer (cents)
- amount: integer (cents, typically quantity * unitPrice)

You must also provide subtotal (sum of amounts) and total (subtotal - discount).

RECURRING ITEMS
---------------
- type: "income" or "expense"
- frequency: "monthly", "quarterly", or "yearly"
- Income items REQUIRE a client ID
- Expense items should have a payee ID
- The "name" field is the display name (REQUIRED)

UPDATE OPERATIONS
-----------------
All update tools use PATCH (partial updates). Only send fields you want to change.
The old PUT endpoints are still available but require ALL fields.

APPROVAL WORKFLOWS
------------------
Quotations: draft → pending_approval → approved → sent → accepted
Payment requests: pending → approved → executed
Monthly close: draft → submitted → approved → finalized

Each approval step may require admin privileges and dual approval.

PDF GENERATION
--------------
PDF tools return a URL path. The full URL is: {base_url}{pdfUrl}
Example: https://your-domain.com/api/invoices/{id}/pdf
`,
      mimeType: 'text/plain',
    }],
  }));
}
