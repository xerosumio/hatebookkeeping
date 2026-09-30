import { Fund } from '../models/Fund.js';
import { FundTransfer } from '../models/FundTransfer.js';
import { Transaction } from '../models/Transaction.js';

export async function adjustFundBalance(bankAccountName: string, amount: number) {
  if (!bankAccountName) return;
  await Fund.findOneAndUpdate(
    { name: bankAccountName, type: 'bank' },
    { $inc: { balance: amount } },
  );
}

export async function reconstructFundBalances(
  funds: Array<{ _id: unknown; name: string; openingBalance: number }>,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (funds.length === 0) return result;

  const ids = funds.map((f) => f._id);
  const names = funds.map((f) => f.name);

  const [txnRows, outRows, inRows] = await Promise.all([
    Transaction.aggregate([
      { $match: { bankAccount: { $in: names } } },
      { $group: { _id: { name: '$bankAccount', type: '$type' }, total: { $sum: '$amount' } } },
    ]),
    FundTransfer.aggregate([
      { $match: { fromFund: { $in: ids } } },
      { $group: { _id: '$fromFund', total: { $sum: '$amount' } } },
    ]),
    FundTransfer.aggregate([
      { $match: { toFund: { $in: ids } } },
      { $group: { _id: '$toFund', total: { $sum: '$amount' } } },
    ]),
  ]);

  const txnNet = new Map<string, number>();
  for (const r of txnRows) {
    const name = r._id.name as string;
    const signed = r._id.type === 'income' ? r.total : -r.total;
    txnNet.set(name, (txnNet.get(name) || 0) + signed);
  }

  const transferNet = new Map<string, number>();
  for (const r of outRows) {
    const id = String(r._id);
    transferNet.set(id, (transferNet.get(id) || 0) - r.total);
  }
  for (const r of inRows) {
    const id = String(r._id);
    transferNet.set(id, (transferNet.get(id) || 0) + r.total);
  }

  for (const fund of funds) {
    const id = String(fund._id);
    result.set(
      id,
      (fund.openingBalance || 0) + (txnNet.get(fund.name) || 0) + (transferNet.get(id) || 0),
    );
  }

  return result;
}
