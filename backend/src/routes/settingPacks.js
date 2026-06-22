import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { validateSettingPack } from '../settingPack.js';

const router = Router();

const PACK_SELECT = {
  playerBackground: true,
  customCharacters: true,
  termDictionary: true,
  difficulty: true,
  updatedAt: true,
};

// GET /api/setting-packs/:worldId — the caller's own pack for a world (or null).
router.get('/:worldId', requireAuth, async (req, res) => {
  const pack = await prisma.userSettingPack.findUnique({
    where: { userId_worldId: { userId: req.user.sub, worldId: req.params.worldId } },
    select: PACK_SELECT,
  });
  res.json({ pack: pack ?? null });
});

// PUT /api/setting-packs/:worldId — upsert the caller's pack (validated + filtered).
router.put('/:worldId', requireAuth, async (req, res) => {
  const { worldId } = req.params;

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { isActive: true },
  });
  if (!world?.isActive) return res.status(404).json({ error: '世界不存在或未開放。' });

  const result = validateSettingPack(req.body ?? {});
  if (!result.ok) return res.status(400).json({ error: result.error });

  const pack = await prisma.userSettingPack.upsert({
    where: { userId_worldId: { userId: req.user.sub, worldId } },
    create: { userId: req.user.sub, worldId, ...result.clean },
    update: { ...result.clean },
    select: PACK_SELECT,
  });
  res.json({ pack });
});

export default router;
