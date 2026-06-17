import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const DAILY_LIMIT = { FREE: 3, PRO: 20 };
const GLOBAL_DAILY_CEILING = parseInt(process.env.GLOBAL_DAILY_TURN_CEILING || '5000', 10);

router.get('/today', requireAuth, async (req, res) => {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const record = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId: req.user.sub, date: today } },
  });
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { plan: true } });
  const used = record?.turns ?? 0;
  const limit = DAILY_LIMIT[user.plan];
  res.json({ used, limit, remaining: Math.max(0, limit - used) });
});

// Called internally (from AI route) — atomic increment, returns new count or 429
export async function consumeTurn(userId, plan) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  // Global ceiling check (raw SQL for atomicity)
  const [{ total }] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(turns), 0)::int AS total
    FROM daily_usage
    WHERE date = ${today}
  `;
  if (total >= GLOBAL_DAILY_CEILING) return { ok: false, reason: 'global_ceiling' };

  const result = await prisma.$queryRaw`
    INSERT INTO daily_usage (id, user_id, date, turns, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${today}, 1, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET turns = daily_usage.turns + 1
    WHERE daily_usage.turns < ${DAILY_LIMIT[plan]}
    RETURNING turns
  `;

  if (result.length === 0) return { ok: false, reason: 'user_limit' };
  return { ok: true, turns: result[0].turns };
}

export default router;
