import prisma from './db.js';

const RECENT_TURNS_KEPT = 10; // turns (user+assistant pairs) retained on a save

// Render a structured save (contentJson) into a zh-TW plain-text recap,
// ordered by the world's saveTemplate field list.
export function renderSave(template, contentJson) {
  if (!contentJson) return '';
  const fields = Array.isArray(template) ? template : Object.keys(contentJson);
  const lines = fields.map((f) => {
    const v = contentJson[f];
    return `${f}：${v == null || v === '' ? '（無）' : v}`;
  });
  return `【存檔紀錄】\n${lines.join('\n')}`;
}

// Most recent save (manual preferred for state; falls back to any) for user+world.
export async function getLatestSave(userId, worldId) {
  return prisma.save.findFirst({
    where: { userId, worldId },
    orderBy: { createdAt: 'desc' },
  });
}

// The latest MANUAL save carries the authoritative structured state.
export async function getLatestState(userId, worldId) {
  const save = await prisma.save.findFirst({
    where: { userId, worldId, kind: 'MANUAL' },
    orderBy: { createdAt: 'desc' },
  });
  return save?.contentJson ?? null;
}

// Build the non-cached "current state" context block from a save's contentJson.
export function buildStateBlock(template, contentJson) {
  const rendered = renderSave(template, contentJson);
  if (!rendered) return '';
  return `以下是玩家目前的狀態摘要，代表先前劇情的累積，請據此延續故事，不要與其矛盾：\n${rendered}`;
}

// Keep only the last N turns (2N entries) of raw history.
export function trimRecentTurns(history) {
  return history.slice(-RECENT_TURNS_KEPT * 2);
}

// Silent rolling auto-save: one AUTO row per user+world, no model call, no turn cost.
export async function rollingAutoSave(userId, worldId, history) {
  const recentTurns = trimRecentTurns(history);
  const currentState = await getLatestState(userId, worldId);

  const existing = await prisma.save.findFirst({
    where: { userId, worldId, kind: 'AUTO' },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await prisma.save.update({
      where: { id: existing.id },
      data: { recentTurns, contentJson: currentState },
    });
  } else {
    await prisma.save.create({
      data: {
        userId, worldId, kind: 'AUTO',
        label: '自動存檔',
        recentTurns, contentJson: currentState,
      },
    });
  }
}

export { RECENT_TURNS_KEPT };
