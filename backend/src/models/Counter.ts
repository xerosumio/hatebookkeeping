import mongoose, { Schema } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

export async function getNextSequence(name: string, entityCode?: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = entityCode ? `${entityCode.toUpperCase()}_` : '';
  const key = `${prefix}${name}_${year}`;
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  const displayPrefix = entityCode ? `${entityCode.toUpperCase()}-` : '';
  return `${displayPrefix}${name.toUpperCase()}-${year}-${String(counter.seq).padStart(4, '0')}`;
}
