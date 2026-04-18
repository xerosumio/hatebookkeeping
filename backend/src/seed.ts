import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from './config/env.js';
import { User } from './models/User.js';

async function seed() {
  await mongoose.connect(env.mongodbUri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: 'admin@hatebookkeeping.local' });
  if (existing) {
    console.log('Admin user already exists');
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash('admin123', 12);
  await User.create({
    email: 'admin@hatebookkeeping.local',
    passwordHash,
    name: 'Admin',
    role: 'admin',
    active: true,
    mustChangePassword: true,
  });

  console.log('Admin user created: admin@hatebookkeeping.local / admin123');
  await mongoose.disconnect();
}

seed().catch(console.error);
