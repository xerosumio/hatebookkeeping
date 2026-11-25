import { Router } from 'express';
import { clientInputSchema, type ClientDto } from '@hbk/shared';
import { requirePermission } from '../../platform/auth.js';
import { notFound, validationError } from '../../platform/errors.js';
import { objectId, parse, route } from '../../platform/http.js';
import { assertUnused } from '../../platform/references.js';
import { Client, type ClientDoc } from './model.js';

export function clientDto(client: ClientDoc): ClientDto {
  return {
    id: String(client._id),
    name: client.name,
    contactPerson: client.contactPerson,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    archived: client.archived,
  };
}

/** The client a new quote or invoice is for: it must exist and not be archived (unless already on the record). */
export async function clientForInput(clientId: string, current?: unknown): Promise<ClientDoc> {
  const client = await Client.findById(clientId);
  if (!client) throw validationError({ clientId: 'Choose a client' });
  if (client.archived && String(current ?? '') !== clientId) {
    throw validationError({ clientId: `${client.name} is archived. Restore it or choose another client` });
  }
  return client;
}

const router = Router();

router.get(
  '/',
  requirePermission('clients.view'),
  route(async (_req, res) => {
    const clients = await Client.find().sort({ archived: 1, name: 1 });
    res.json(clients.map(clientDto));
  }),
);

router.post(
  '/',
  requirePermission('clients.manage'),
  route(async (req, res) => {
    const client = await Client.create(parse(clientInputSchema, req.body));
    res.status(201).json(clientDto(client));
  }),
);

async function load(id: unknown): Promise<ClientDoc> {
  const client = await Client.findById(objectId(id, 'That client'));
  if (!client) throw notFound('That client');
  return client;
}

router.put(
  '/:id',
  requirePermission('clients.manage'),
  route(async (req, res) => {
    const input = parse(clientInputSchema, req.body);
    const client = await load(req.params.id);
    client.set(input);
    await client.save();
    res.json(clientDto(client));
  }),
);

for (const [action, archived] of [
  ['archive', true],
  ['restore', false],
] as const) {
  router.post(
    `/:id/${action}`,
    requirePermission('clients.manage'),
    route(async (req, res) => {
      const client = await load(req.params.id);
      client.archived = archived;
      await client.save();
      res.json(clientDto(client));
    }),
  );
}

/** Only a client nothing refers to can be deleted; otherwise it is archived. */
router.delete(
  '/:id',
  requirePermission('clients.manage'),
  route(async (req, res) => {
    const client = await load(req.params.id);
    await assertUnused('client', String(client._id), client.name);
    await client.deleteOne();
    res.status(204).end();
  }),
);

export default router;
