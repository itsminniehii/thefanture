import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { consumeTurn } from './usage.js';
import hogwartsSystemPrompt from '../prompts/hogwarts.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Model selection — backend-authoritative, never from client
const MODEL = {
  FREE: 'claude-sonnet-4-6',
  PRO:  'claude-opus-4-8',
};

// System prompts by world slug
const SYSTEM_PROMPTS = {
  hogwarts: hogwartsSystemPrompt,
};

router.post('/chat', requireAuth, async (req, res) => {
  const { worldId, message, history = [] } = req.body;

  if (!worldId || !message) {
    return res.status(400).json({ error: 'worldId and message are required' });
  }

  // Look up world to get its slug
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { slug: true, isActive: true },
  });
  if (!world || !world.isActive) {
    return res.status(404).json({ error: 'World not found or inactive' });
  }

  const systemPrompt = SYSTEM_PROMPTS[world.slug];
  if (!systemPrompt) {
    return res.status(500).json({ error: 'System prompt not configured for this world' });
  }

  // Fetch user plan
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { plan: true },
  });

  // --- STEP 1: consume turn BEFORE any model call ---
  const turnResult = await consumeTurn(req.user.sub, user.plan);
  if (!turnResult.ok) {
    const status = turnResult.reason === 'global_ceiling' ? 503 : 429;
    const message = turnResult.reason === 'global_ceiling'
      ? '今日全站額度已達上限，請稍後再試。'
      : '你今日的回合已用完，明日再繼續吧。';
    return res.status(status).json({ error: message, reason: turnResult.reason });
  }

  // --- STEP 2: call model ---
  const model = MODEL[user.plan];

  // Build messages: history + new user message
  // history format: [{role:'user'|'assistant', content: string}]
  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 500,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const { cache_creation_input_tokens, cache_read_input_tokens, input_tokens, output_tokens } =
      response.usage;

    console.log(
      `[cache] world=${world.slug} model=${model} ` +
      `cache_creation=${cache_creation_input_tokens ?? 0} ` +
      `cache_read=${cache_read_input_tokens ?? 0} ` +
      `input=${input_tokens} output=${output_tokens} ` +
      `turns_used=${turnResult.turns}`
    );

    const text = response.content[0]?.text ?? '';
    res.json({ text, turns_used: turnResult.turns });
  } catch (err) {
    // Turn was already consumed — do not refund (prevents abuse via error-looping)
    console.error('[ai] model error:', err.message);
    res.status(502).json({ error: '模型回應異常，請稍後再試。' });
  }
});

export default router;
