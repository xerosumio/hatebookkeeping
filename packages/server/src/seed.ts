import mongoose from 'mongoose';
import { env } from './config/env.js';

async function seed() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');
  console.log('Users are created on first Authentik sign-in (matched by email).');
  console.log('Nothing to seed.');
  await mongoose.disconnect();
}

seed().catch(console.error);
