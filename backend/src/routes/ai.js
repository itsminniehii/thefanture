import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db.js';
import { consumeTurn, refundTurn, DAILY_LIMIT } from './usage.js';
import hogwartsSystemPrompt from '../prompts/hogwarts.js';
import { MODELS, MAX_OUTPUT_TOKENS, resolveModelKey } from '../models.js';
import {
  getLatestState, buildStateBlock, trimRecentTurns, rollingAutoSave, renderSave,
} from '../saveService.js';

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPTS = { hogwarts: hogwartsSystemPrompt };

const SAVE_KEYWORD = '存檔';
const AUTOSAVE_EVERY = 5; // turns

// ── Anthropic call ──────────────────────────────────────────────────────────
// stateBlock (changes per save) goes AFTER the cached system breakpoint so the
// stable prefix still hits the cache.
async function callAnthropic(modelString, systemPrompt, stateBlock, messages) {
  const system = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  if (stateBlock) system.push({ type: 'text', text: stateBlock });

  const response = await anthropic.messages.create({
    model: modelString,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages,
  });

  const u = response.usage;
  console.log(
    `[cache] model=${modelString} ` +
    `cache_creation=${u.cache_creation_input_tokens ?? 0} ` +
    `cache_read=${u.cache_read_input_tokens ?? 0} ` +
    `input=${u.input_tokens} output=${u.output_tokens}`
  );
  return response.content[0]?.text ?? '';
}

// ── Gemini call ───────────────────────────────────────────────────────────────
async function callGemini(modelString, systemPrompt, stateBlock, messages) {
  const systemInstruction = stateBlock ? `${systemPrompt}\n\n${stateBlock}` : systemPrompt;
  const model = geminiClient.getGenerativeModel({
    model: modelString,
    systemInstruction,
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  });

  const history = messages.slice(0, -1).map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: content }],
  }));
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(messages[messages.length - 1].content);
  const text = result.response.text();
  console.log(`[gemini] model=${modelString} output_chars=${text.length}`);
  return text;
}

// Provider dispatch by model key.
async function callModel(modelKey, systemPrompt, stateBlock, messages) {
  const { provider, modelString } = MODELS[modelKey];
  return provider === 'google'
    ? callGemini(modelString, systemPrompt, stateBlock, messages)
    : callAnthropic(modelString, systemPrompt, stateBlock, messages);
}

// ── Streaming variants ────────────────────────────────────────────────────────
// Each emits text via onDelta and returns { cache_creation, cache_read }.

async function streamAnthropic(modelString, systemPrompt, stateBlock, messages, onDelta) {
  const system = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  if (stateBlock) system.push({ type: 'text', text: stateBlock });

  const stream = anthropic.messages.stream({
    model: modelString,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      onDelta(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const u = final.usage;
  const cache_creation = u.cache_creation_input_tokens ?? 0;
  const cache_read = u.cache_read_input_tokens ?? 0;
  console.log(
    `[cache] model=${modelString} cache_creation=${cache_creation} ` +
    `cache_read=${cache_read} input=${u.input_tokens} output=${u.output_tokens}`
  );
  return { cache_creation, cache_read };
}

async function streamGemini(modelString, systemPrompt, stateBlock, messages, onDelta) {
  const systemInstruction = stateBlock ? `${systemPrompt}\n\n${stateBlock}` : systemPrompt;
  const model = geminiClient.getGenerativeModel({
    model: modelString,
    systemInstruction,
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  });

  const history = messages.slice(0, -1).map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: content }],
  }));
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(messages[messages.length - 1].content);

  let chars = 0;
  for await (const chunk of result.stream) {
    const t = chunk.text();
    if (t) { chars += t.length; onDelta(t); }
  }
  const resp = await result.response;
  const cache_read = resp.usageMetadata?.cachedContentTokenCount ?? 0;
  console.log(`[gemini] model=${modelString} output_chars=${chars} cache_read=${cache_read}`);
  return { cache_creation: 0, cache_read };
}

async function streamModel(modelKey, systemPrompt, stateBlock, messages, onDelta) {
  const { provider, modelString } = MODELS[modelKey];
  return provider === 'google'
    ? streamGemini(modelString, systemPrompt, stateBlock, messages, onDelta)
    : streamAnthropic(modelString, systemPrompt, stateBlock, messages, onDelta);
}

// One SSE event.
function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Pull JSON out of a model reply that may be wrapped in ```json fences or prose.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object found');
  return JSON.parse(candidate.slice(start, end + 1));
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
router.post('/chat', requireAuth, async (req, res) => {
  const { worldId, message, history = [], preferredModel, stream = false } = req.body;
  if (!worldId || !message) {
    return res.status(400).json({ error: 'worldId and message are required' });
  }

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { slug: true, isActive: true, saveTemplate: true },
  });
  if (!world?.isActive) return res.status(404).json({ error: 'World not found or inactive' });

  const systemPrompt = SYSTEM_PROMPTS[world.slug];
  if (!systemPrompt) return res.status(500).json({ error: 'System prompt not configured for this world' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { plan: true, preferredModel: true },
  });

  // --- STEP 1: consume turn BEFORE any model call (save counts as a turn too) ---
  const turnResult = await consumeTurn(req.user.sub, user.plan);
  if (!turnResult.ok) {
    const status = turnResult.reason === 'global_ceiling' ? 503 : 429;
    const msg = turnResult.reason === 'global_ceiling'
      ? '今日全站額度已達上限，請稍後再試。'
      : '你今日的回合已用完，明日再繼續吧。';
    return res.status(status).json({ error: msg, reason: turnResult.reason });
  }

  // --- STEP 2: resolve model (backend authoritative; client hint validated) ---
  const modelKey = resolveModelKey(user.plan, preferredModel ?? user.preferredModel);

  // Context compression: system prompt + latest save JSON as "current state" + last 10 turns.
  const currentState = await getLatestState(req.user.sub, worldId);
  const stateBlock = buildStateBlock(world.saveTemplate, currentState);
  const recentHistory = trimRecentTurns(history);
  console.log(
    `[ai] world=${world.slug} plan=${user.plan} modelKey=${modelKey} ` +
    `history_in=${history.length} history_sent=${recentHistory.length} hasState=${!!currentState}`
  );

  const isSave = message.trim() === SAVE_KEYWORD;

  try {
    if (isSave) {
      // --- SAVE FLOW: ask the model for template-only JSON, then persist ---
      const fields = Array.isArray(world.saveTemplate) ? world.saveTemplate : [];
      const instruction =
        `請依目前劇情的最新狀態，只輸出一個 JSON 物件，欄位為：${fields.join('、')}。` +
        `每個欄位填入繁體中文簡述，不要輸出 JSON 以外的任何文字、說明或標點。`;
      const saveMessages = [...recentHistory, { role: 'user', content: instruction }];

      const raw = await callModel(modelKey, systemPrompt, stateBlock, saveMessages);
      let contentJson;
      try {
        contentJson = extractJson(raw);
      } catch (e) {
        console.error('[save] JSON parse failed:', e.message, '| raw:', raw.slice(0, 200));
        return res.status(502).json({ error: '存檔產生失敗，請再試一次。' });
      }

      const rendered = renderSave(world.saveTemplate, contentJson);
      await prisma.save.create({
        data: {
          userId: req.user.sub, worldId, kind: 'MANUAL',
          label: '存檔', contentJson, rendered,
          recentTurns: recentHistory,
        },
      });

      return res.json({ saved: true, rendered, turns_used: turnResult.turns, model: modelKey });
    }

    // --- NORMAL PLAY ---
    const messages = [...recentHistory, { role: 'user', content: message }];
    const limit = DAILY_LIMIT[user.plan];

    // Auto-save runs only AFTER the model reply is complete (never mid-stream).
    const maybeAutoSave = (fullText) => {
      if (turnResult.turns % AUTOSAVE_EVERY !== 0) return false;
      const fullHistory = [
        ...history,
        { role: 'user', content: message },
        { role: 'assistant', content: fullText },
      ];
      rollingAutoSave(req.user.sub, worldId, fullHistory)
        .catch((e) => console.error('[autosave] failed:', e.message));
      return true;
    };

    if (!stream) {
      // Non-streaming path (unchanged behavior).
      const text = await callModel(modelKey, systemPrompt, stateBlock, messages);
      const autosaved = maybeAutoSave(text);
      return res.json({
        text, turns_used: turnResult.turns, model: modelKey,
        remaining: Math.max(0, limit - turnResult.turns), autosaved,
      });
    }

    // --- STREAMING PATH (all state-changing decisions already done) ---
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();

    let fullText = '';
    try {
      const { cache_creation, cache_read } = await streamModel(
        modelKey, systemPrompt, stateBlock, messages,
        (delta) => { fullText += delta; sse(res, 'delta', { text: delta }); },
      );

      const autosaved = maybeAutoSave(fullText);
      sse(res, 'done', {
        text: fullText,
        cache_creation, cache_read,
        turns_used: turnResult.turns,
        remaining: Math.max(0, limit - turnResult.turns),
        model: modelKey,
        autosaved,
      });
      res.end();
    } catch (err) {
      console.error('[ai] stream error:', err.message);
      // Refund only if the stream never produced any output.
      if (fullText === '') {
        await refundTurn(req.user.sub).catch(() => {});
      }
      sse(res, 'error', { error: '模型回應異常，請稍後再試。' });
      res.end();
    }
  } catch (err) {
    console.error('[ai] model error:', err.message);
    if (res.headersSent) { res.end(); return; }
    res.status(502).json({ error: '模型回應異常，請稍後再試。' });
  }
});

export default router;
