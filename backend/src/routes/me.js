import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { PLAN_ALLOWLIST } from '../models.js';

const router = Router();

router.post('/model', requireAuth, async (req, res) => {
  const { preferredModel } = req.body;
  if (!preferredModel) return res.status(400).json({ error: 'preferredModel is required' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { plan: true },
  });

  const allowed = PLAN_ALLOWLIST[user.plan];
  if (!allowed.includes(preferredModel)) {
    return res.status(400).json({
      error: `此方案不支援所選模型。可用選項：${allowed.join('、')}`,
    });
  }

  await prisma.user.update({
    where: { id: req.user.sub },
    data: { preferredModel },
  });

  res.json({ preferredModel });
});

router.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, email: true, plan: true, preferredModel: true, uiTheme: true },
  });
  res.json(user);
});

export default router;
