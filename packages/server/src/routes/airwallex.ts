import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  resolveEntity,
  getBalances,
  getTokenStatus,
} from '../services/airwallex.js';

const router = Router();
router.use(authMiddleware);

router.get('/balance/:entity', async (req, res, next) => {
  try {
    const key = resolveEntity(req.params.entity);
    const balances = await getBalances(key);
    const hkd = balances.find((b) => b.currency === 'HKD');
    res.json({
      currency: 'HKD',
      total_amount: Math.round((hkd?.total_amount ?? 0) * 100),
      available_amount: Math.round((hkd?.available_amount ?? 0) * 100),
      pending_amount: Math.round((hkd?.pending_amount ?? 0) * 100),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/status', async (_req, res, next) => {
  try {
    const tokens = getTokenStatus();

    let liveAx = null;
    let liveNt = null;
    try {
      const axBal = await getBalances('ax');
      const hkd = axBal.find((b) => b.currency === 'HKD');
      if (hkd) liveAx = Math.round(hkd.total_amount * 100);
    } catch {}
    try {
      const ntBal = await getBalances('nt');
      const hkd = ntBal.find((b) => b.currency === 'HKD');
      if (hkd) liveNt = Math.round(hkd.total_amount * 100);
    } catch {}

    res.json({
      ax: {
        token: tokens.ax,
        bankBalance: liveAx,
      },
      nt: {
        token: tokens.nt,
        bankBalance: liveNt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
