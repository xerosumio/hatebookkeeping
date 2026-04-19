import { Fund } from '../models/Fund.js';

export async function adjustFundBalance(bankAccountName: string, amount: number) {
  if (!bankAccountName) return;
  await Fund.findOneAndUpdate(
    { name: bankAccountName, type: 'bank' },
    { $inc: { balance: amount } },
  );
}
