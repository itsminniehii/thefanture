<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { usage, me, ai, readSSE } from '../api.js';
import SettingPackForm from './SettingPackForm.vue';
import WorldShelf from './WorldShelf.vue';
import { WORLDS } from '../constants/worlds.js';

const props = defineProps({ token: String, plan: String });

const HOGWARTS_WORLD_ID = import.meta.env.VITE_HOGWARTS_WORLD_ID;

const selectedWorldId = ref(null);
const settingPackDone = ref(false);
const usageInfo    = ref({ used: 0, limit: 0, remaining: 0 });
const narrative    = ref([]);   // [{role, content, ...}]
const input        = ref('');
const sending      = ref(false);
const limitReached = ref(false);
const errorMsg     = ref('');
const userInfo     = ref(null);
const narrativeEl  = ref(null);

// Typewriter buffer for the currently streaming entry
const streamingEntry = ref(null);
let revealTimer = null;

function startReveal() {
  stopReveal();
  revealTimer = setInterval(() => {
    const e = streamingEntry.value;
    if (!e || e.revealAll) return;
    if (e.buffer.length === 0) return;
    const take = Math.min(3, e.buffer.length);
    e.displayed += e.buffer.slice(0, take);
    e.buffer = e.buffer.slice(take);
    scrollToBottom();
  }, 15);
}
function stopReveal() {
  if (revealTimer) { clearInterval(revealTimer); revealTimer = null; }
}
function flushBuffer(e) {
  if (!e) return;
  e.displayed += e.buffer;
  e.buffer = '';
}
function showAll() {
  const e = streamingEntry.value;
  if (!e) return;
  flushBuffer(e);
  e.revealAll = true;   // subsequent deltas append immediately
  scrollToBottom();
}

async function scrollToBottom() {
  await nextTick();
  narrativeEl.value?.scrollTo({ top: narrativeEl.value.scrollHeight, behavior: 'auto' });
}

async function loadMeta() {
  const [u, m] = await Promise.all([usage.today(props.token), me.get(props.token)]);
  usageInfo.value = u;
  userInfo.value  = m;
  if (u.remaining === 0) limitReached.value = true;
}

function applyRemaining(data) {
  if (typeof data.turns_used === 'number') usageInfo.value.used = data.turns_used;
  if (typeof data.remaining === 'number') usageInfo.value.remaining = data.remaining;
  if (usageInfo.value.remaining === 0) limitReached.value = true;
}

async function send() {
  const msg = input.value.trim();
  if (!msg || sending.value || limitReached.value) return;

  input.value    = '';
  sending.value  = true;   // disables input + send button while streaming
  errorMsg.value = '';

  narrative.value.push({ role: 'user', content: msg });

  // Real dialogue only (exclude save cards), last 10 turns (20 entries).
  const history = narrative.value
    .filter((e) => e.role === 'user' || e.role === 'assistant')
    .map((e) => ({ role: e.role, content: e.role === 'assistant' ? (e.displayed ?? e.content) : e.content }))
    .slice(-21, -1);

  try {
    const res = await ai.chatStream(
      props.token, HOGWARTS_WORLD_ID, msg, history,
    );

    const ctype = res.headers.get('content-type') || '';

    // Non-stream responses: 429 limit, save card, or error JSON.
    if (!ctype.includes('text/event-stream')) {
      const data = await res.json();
      if (res.status === 429) {
        limitReached.value = true;
        narrative.value.push({ role: 'assistant', content: data.error ?? '今日回合已用完。' });
      } else if (data.saved) {
        narrative.value.push({ role: 'save', content: data.rendered });
        applyRemaining(data);
      } else if (!res.ok) {
        narrative.value.push({ role: 'assistant', content: data.error ?? '發生錯誤。' });
      } else if (data.text) {
        narrative.value.push({ role: 'assistant', content: data.text });
        applyRemaining(data);
      }
      return;
    }

    // Streaming: prepare an empty assistant entry as the sink.
    const entry = ref({ role: 'assistant', displayed: '', buffer: '', revealAll: false, streaming: true });
    narrative.value.push(entry.value);
    streamingEntry.value = entry.value;
    startReveal();

    await readSSE(res, {
      delta: (d) => {
        const e = streamingEntry.value;
        if (e.revealAll) { e.displayed += d.text; scrollToBottom(); }
        else e.buffer += d.text;
      },
      done: (d) => {
        const e = streamingEntry.value;
        flushBuffer(e);
        e.streaming = false;
        applyRemaining(d);
      },
      error: (d) => {
        const e = streamingEntry.value;
        flushBuffer(e);
        e.displayed += `\n（${d.error ?? '模型回應異常'}）`;
        e.streaming = false;
        e.failed = true;
      },
    });
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    stopReveal();
    if (streamingEntry.value) { flushBuffer(streamingEntry.value); streamingEntry.value.streaming = false; }
    streamingEntry.value = null;
    sending.value = false;
    scrollToBottom();
  }
}

onMounted(loadMeta);
onUnmounted(stopReveal);
</script>

<template>
  <WorldShelf
    v-if="!selectedWorldId"
    :worlds="WORLDS"
    @select="selectedWorldId = $event"
  />

  <SettingPackForm
    v-else-if="!settingPackDone"
    :world-id="selectedWorldId"
    :token="token"
    @saved="settingPackDone = true"
    @skip="settingPackDone = true"
  />

  <div v-else style="display:flex;flex-direction:column;height:100vh;max-width:720px;margin:0 auto;padding:0 16px">

    <!-- Header -->
    <div style="padding:12px 0;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;align-items:center">
      <strong>霍格華茲</strong>
      <span>今日剩餘：{{ usageInfo.remaining }} / {{ usageInfo.limit }} 回合</span>
    </div>

    <!-- Narrative area -->
    <div ref="narrativeEl" style="flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:16px">
      <div v-if="narrative.length === 0" style="color:#888">（開始輸入，進入霍格華茲……）</div>

      <div v-for="(entry, i) in narrative" :key="i"
           :style="{ marginLeft: entry.role === 'user' ? 'auto' : '0', maxWidth: '90%' }">
        <div v-if="entry.role === 'user'" style="background:#f0f0f0;padding:8px 12px;border-radius:4px;white-space:pre-wrap">
          {{ entry.content }}
        </div>
        <div v-else-if="entry.role === 'save'" style="border:1px dashed #888;background:#fafaf0;padding:12px;white-space:pre-wrap;font-family:monospace;font-size:0.9em">
          {{ entry.content }}
        </div>
        <div v-else style="white-space:pre-wrap;line-height:1.8">
          {{ entry.displayed ?? entry.content }}<span v-if="entry.streaming" style="opacity:0.5">▌</span>
        </div>
      </div>
    </div>

    <!-- Show-all control (only while a stream is in flight) -->
    <div v-if="streamingEntry && !streamingEntry.revealAll" style="padding:4px 0">
      <button @click="showAll" style="font-size:0.85em">全部顯示</button>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" style="color:red;padding:4px 0;font-size:0.9em">{{ errorMsg }}</div>

    <!-- Input area -->
    <div style="padding:12px 0;border-top:1px solid #ccc;display:flex;gap:8px">
      <textarea
        v-model="input"
        :disabled="sending || limitReached"
        :placeholder="limitReached ? '今日回合已用完，明日再繼續吧。' : '輸入你的行動……'"
        rows="3" style="flex:1;resize:none"
        @keydown.enter.exact.prevent="send"
      />
      <button @click="send" :disabled="sending || limitReached || !input.trim()" style="align-self:flex-end">
        {{ sending ? '串流中…' : '送出' }}
      </button>
    </div>

  </div>
</template>
