import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';

const router = Router();

// GET /api/saves?worldId=...  → this user's saves in that world (newest first)
router.get('/', requireAuth, async (req, res) => {
  const { worldId } = req.query;
  if (!worldId) return res.status(400).json({ error: 'worldId is required' });

  const saves = await prisma.save.findMany({
    where: { userId: req.user.sub, worldId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, kind: true, label: true, rendered: true,
      contentJson: true, createdAt: true,
    },
  });

  res.json({ saves });
});

export default router;
