import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { DAILY_LIMIT, OPUS_SUBQUOTA, SONNET_BUFFER } from '../models.js';

const router = Router();

// DAILY_LIMIT is centralized in models.js (PLAN_CONFIG). Re-exported here so
// existing importers (ai.js) keep working without touching their import paths.
export { DAILY_LIMIT };
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

// Give a turn back when a model call fails before any output was produced.
// Atomic, never drops below 0.
export async function refundTurn(userId) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  await prisma.$queryRaw`
    UPDATE daily_usage
    SET turns = GREATEST(turns - 1, 0)
    WHERE user_id = ${userId} AND date = ${today}
  `;
}

// Advanced-tier downgrade chain, resolved atomically so concurrent turns can't
// overrun a sub-quota: claim an Opus slot, else a Sonnet slot, else fall back to
// Gemini Pro. The daily_usage row already exists (consumeTurn ran first).
// Returns { modelKey, counter } where counter is the column to refund on failure
// ('opus' | 'sonnet' | null for the unmetered Gemini Pro fallback).
export async function claimAdvancedSlot(userId) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);

  const opus = await prisma.$queryRaw`
    UPDATE daily_usage SET opus_turns = opus_turns + 1
    WHERE user_id = ${userId} AND date = ${today} AND opus_turns < ${OPUS_SUBQUOTA}
    RETURNING opus_turns
  `;
  if (opus.length > 0) return { modelKey: 'opus', counter: 'opus' };

  const sonnet = await prisma.$queryRaw`
    UPDATE daily_usage SET sonnet_turns = sonnet_turns + 1
    WHERE user_id = ${userId} AND date = ${today} AND sonnet_turns < ${SONNET_BUFFER}
    RETURNING sonnet_turns
  `;
  if (sonnet.length > 0) return { modelKey: 'sonnet', counter: 'sonnet' };

  return { modelKey: 'gemini-pro', counter: null };
}

// Refund a claimed sub-quota slot when the model call fails before any output.
export async function refundSubCounter(userId, counter) {
  if (!counter) return;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (counter === 'opus') {
    await prisma.$queryRaw`
      UPDATE daily_usage SET opus_turns = GREATEST(opus_turns - 1, 0)
      WHERE user_id = ${userId} AND date = ${today}
    `;
  } else if (counter === 'sonnet') {
    await prisma.$queryRaw`
      UPDATE daily_usage SET sonnet_turns = GREATEST(sonnet_turns - 1, 0)
      WHERE user_id = ${userId} AND date = ${today}
    `;
  }
}

// Test-only endpoint: POST /api/usage/consume-test  (disabled in production)
if (process.env.NODE_ENV !== 'production') {
  router.post('/consume-test', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { plan: true } });
    const result = await consumeTurn(req.user.sub, user.plan);
    res.status(result.ok ? 200 : 429).json(result);
  });
}

export default router;
