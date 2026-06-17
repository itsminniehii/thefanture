import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { consumeTurn } from './usage.js';
import hogwartsSystemPrompt from '../prompts/hogwarts.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Canonical model key → actual API model string
const MODEL_IDS = {
  'opus':       'claude-opus-4-8',
  'sonnet':     'claude-sonnet-4-6',
  'gemini-pro': 'gemini-2.5-flash',
};

// Per-plan allowlists — backend-authoritative
const PLAN_ALLOWLIST = {
  FREE: ['gemini-pro', 'sonnet'],
  PRO:  ['gemini-pro', 'opus'],
};

// Resolve which model key to use for this user
function resolveModelKey(plan, preferredModel) {
  const list = PLAN_ALLOWLIST[plan];
  if (preferredModel && list.includes(preferredModel)) return preferredModel;
  return list[0];
}

// System prompts by world slug
const SYSTEM_PROMPTS = {
  hogwarts: hogwartsSystemPrompt,
};

// ── Anthropic call ────────────────────────────────────────────────────────────
async function callAnthropic(modelId, systemPrompt, messages) {
  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 500,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  const { cache_creation_input_tokens, cache_read_input_tokens, input_tokens, output_tokens } =
    response.usage;
  console.log(
    `[cache] model=${modelId} ` +
    `cache_creation=${cache_creation_input_tokens ?? 0} ` +
    `cache_read=${cache_read_input_tokens ?? 0} ` +
    `input=${input_tokens} output=${output_tokens}`
  );

  return response.content[0]?.text ?? '';
}

// ── Gemini call ───────────────────────────────────────────────────────────────
async function callGemini(modelId, systemPrompt, messages) {
  const model = geminiClient.getGenerativeModel({
    model: modelId,
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 500 },
  });

  // Convert to Gemini history format (all but last message)
  const history = messages.slice(0, -1).map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: content }],
  }));

  const chat = model.startChat({ history });
  const lastMessage = messages[messages.length - 1].content;
  const result = await chat.sendMessage(lastMessage);
  const text = result.response.text();

  console.log(`[gemini] model=${modelId} output_chars=${text.length}`);
  return text;
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
  const { worldId, message, history = [], preferredModel } = req.body;

  if (!worldId || !message) {
    return res.status(400).json({ error: 'worldId and message are required' });
  }

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { slug: true, isActive: true },
  });
  if (!world?.isActive) {
    return res.status(404).json({ error: 'World not found or inactive' });
  }

  const systemPrompt = SYSTEM_PROMPTS[world.slug];
  if (!systemPrompt) {
    return res.status(500).json({ error: 'System prompt not configured for this world' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { plan: true, preferredModel: true },
  });

  // --- STEP 1: consume turn BEFORE any model call ---
  const turnResult = await consumeTurn(req.user.sub, user.plan);
  if (!turnResult.ok) {
    const status = turnResult.reason === 'global_ceiling' ? 503 : 429;
    const msg = turnResult.reason === 'global_ceiling'
      ? '今日全站額度已達上限，請稍後再試。'
      : '你今日的回合已用完，明日再繼續吧。';
    return res.status(status).json({ error: msg, reason: turnResult.reason });
  }

  // --- STEP 2: resolve model (backend decides, client hint validated) ---
  // Client may send preferredModel as a one-time hint; stored preference is authoritative
  const effectivePreferred = preferredModel ?? user.preferredModel;
  const modelKey = resolveModelKey(user.plan, effectivePreferred);
  const modelId  = MODEL_IDS[modelKey];

  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ];

  console.log(`[ai] world=${world.slug} plan=${user.plan} modelKey=${modelKey}`);

  try {
    let text;
    if (modelKey === 'gemini-pro') {
      text = await callGemini(modelId, systemPrompt, messages);
    } else {
      text = await callAnthropic(modelId, systemPrompt, messages);
    }
    res.json({ text, turns_used: turnResult.turns, model: modelKey });
  } catch (err) {
    console.error('[ai] model error:', err.message);
    res.status(502).json({ error: '模型回應異常，請稍後再試。' });
  }
});

export default router;
