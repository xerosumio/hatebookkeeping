import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const notifications = await Notification.find({
      recipient: req.user!._id,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.get('/unread-count', async (req: AuthRequest, res, next) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user!._id,
      read: false,
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!._id },
      { read: true },
      { new: true },
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req: AuthRequest, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user!._id, read: false },
      { read: true },
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
