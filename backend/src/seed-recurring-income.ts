import mongoose from 'mongoose';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Entity } from './models/Entity.js';
import { Client } from './models/Client.js';
import { RecurringItem } from './models/RecurringItem.js';

interface RowData {
  clientName: string;
  serviceName: string;
  entityCode: string;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  amountCents: number;
  startDate?: Date;
}

const rows: RowData[] = [
  { clientName: 'Beigehill Asset Management Limited', serviceName: 'IT Support', entityCode: 'AX', frequency: 'quarterly', amountCents: 0 },
  { clientName: 'Beigehill Asset Management Limited', serviceName: 'O365', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'Beigehill Asset Management Limited', serviceName: 'Dropbox', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'Beigehill Asset Management Limited', serviceName: 'Adobe', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'ATK Fund I LPF', serviceName: 'O365', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'Chao Galaxy Culture Media', serviceName: 'O365', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'Mai Feng (Hong Kong) Capital Limited', serviceName: 'O365', entityCode: 'AX', frequency: 'monthly', amountCents: 0 },
  { clientName: 'Omron', serviceName: 'Hosting', entityCode: 'NL', frequency: 'yearly', amountCents: 560000, startDate: new Date('2025-10-21') },
  { clientName: 'Omron', serviceName: 'Jump Server', entityCode: 'NL', frequency: 'yearly', amountCents: 1000000, startDate: new Date('2025-12-23') },
  { clientName: 'Ebonyhousehold Limited', serviceName: 'Hosting', entityCode: 'AX', frequency: 'yearly', amountCents: 100000 },
  { clientName: 'SignHouse', serviceName: 'Premium IT Subscription', entityCode: 'AX', frequency: 'monthly', amountCents: 1500000, startDate: new Date('2026-05-01') },
  { clientName: '90Cents Management Limited', serviceName: 'Development Outsource', entityCode: 'NL', frequency: 'monthly', amountCents: 600000, startDate: new Date('2026-03-01') },
];

async function main() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');

  const thomas = await User.findOne({ name: /thomas/i });
  if (!thomas) throw new Error('User "Thomas" not found');
  console.log(`Using createdBy: ${thomas.name} (${thomas._id})`);

  const entities = await Entity.find();
  const entityMap = new Map(entities.map((e) => [e.code, e]));
  console.log(`Found entities: ${entities.map((e) => e.code).join(', ')}`);

  const clientCache = new Map<string, mongoose.Types.ObjectId>();

  async function getOrCreateClient(name: string, entityId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
    const key = name.toLowerCase().trim();
    if (clientCache.has(key)) return clientCache.get(key)!;

    let client = await Client.findOne({ name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, 'i') } });
    if (!client) {
      client = await Client.create({ name: name.trim(), entity: entityId, createdBy: thomas!._id });
      console.log(`  Created client: ${client.name}`);
    } else {
      console.log(`  Found client: ${client.name}`);
    }

    clientCache.set(key, client._id);
    return client._id;
  }

  let created = 0;
  for (const row of rows) {
    const entity = entityMap.get(row.entityCode);
    if (!entity) {
      console.warn(`  Skipping "${row.serviceName}" — entity ${row.entityCode} not found`);
      continue;
    }

    const clientId = await getOrCreateClient(row.clientName, entity._id);

    const existing = await RecurringItem.findOne({
      name: row.serviceName,
      client: clientId,
      entity: entity._id,
      type: 'income',
    });

    if (existing) {
      console.log(`  Skipping duplicate: ${row.clientName} — ${row.serviceName}`);
      continue;
    }

    await RecurringItem.create({
      name: row.serviceName,
      entity: entity._id,
      type: 'income',
      category: 'IT Services',
      amount: row.amountCents,
      frequency: row.frequency,
      client: clientId,
      description: '',
      startDate: row.startDate || undefined,
      active: true,
      dueDay: 1,
      alertDaysBefore: 7,
      createdBy: thomas._id,
    });
    created++;
    console.log(`  Created: ${row.clientName} — ${row.serviceName} (${row.frequency}, ${row.amountCents} cents)`);
  }

  console.log(`\nDone. Created ${created} recurring income items.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
