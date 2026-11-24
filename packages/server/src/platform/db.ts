import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri);
  // Unique indexes carry real rules here (one invoice per quote milestone, one
  // salary run per month, one recurring document per period), so make sure
  // they exist before the first request is served.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
