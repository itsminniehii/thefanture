<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { usage, me, ai } from '../api.js';

const props = defineProps({ token: String, plan: String });

// Hogwarts world ID — seeded in DB; in production this would come from an API call
const HOGWARTS_WORLD_ID = import.meta.env.VITE_HOGWARTS_WORLD_ID;

const usageInfo    = ref({ used: 0, limit: 0, remaining: 0 });
const narrative    = ref([]);   // [{role:'user'|'assistant', content:string}]
const input        = ref('');
const sending      = ref(false);
const limitReached = ref(false);
const errorMsg     = ref('');
const userInfo     = ref(null);
const narrativeEl  = ref(null);

// Model switcher (PRO only)
const PRO_MODELS = ['gemini-pro', 'opus'];
const selectedModel = ref('');

async function loadMeta() {
  const [u, m] = await Promise.all([
    usage.today(props.token),
    me.get(props.token),
  ]);
  usageInfo.value  = u;
  userInfo.value   = m;
  selectedModel.value = m.preferredModel ?? (props.plan === 'PRO' ? 'gemini-pro' : '');
  if (u.remaining === 0) limitReached.value = true;
}

async function switchModel(modelKey) {
  try {
    await me.setModel(props.token, modelKey);
    selectedModel.value = modelKey;
    userInfo.value.preferredModel = modelKey;
  } catch (e) {
    errorMsg.value = e.message;
  }
}

async function send() {
  const msg = input.value.trim();
  if (!msg || sending.value || limitReached.value) return;

  input.value   = '';
  sending.value = true;
  errorMsg.value = '';

  narrative.value.push({ role: 'user', content: msg });

  // Keep last 10 turns as history (20 entries: 10 user + 10 assistant)
  const history = narrative.value.slice(-21, -1);

  try {
    const data = await ai.chat(
      props.token,
      HOGWARTS_WORLD_ID,
      msg,
      history,
      selectedModel.value || undefined,
    );

    narrative.value.push({ role: 'assistant', content: data.text });
    usageInfo.value.used      = data.turns_used;
    usageInfo.value.remaining = Math.max(0, usageInfo.value.limit - data.turns_used);
    if (usageInfo.value.remaining === 0) limitReached.value = true;
  } catch (e) {
    if (e.status === 429) {
      limitReached.value = true;
      narrative.value.push({ role: 'assistant', content: e.data?.error ?? '今日回合已用完。' });
    } else {
      errorMsg.value = e.message;
      // Remove the user message we optimistically pushed
      narrative.value.pop();
    }
  } finally {
    sending.value = false;
    await nextTick();
    narrativeEl.value?.scrollTo({ top: narrativeEl.value.scrollHeight, behavior: 'smooth' });
  }
}

onMounted(loadMeta);
</script>

<template>
  <div style="display:flex;flex-direction:column;height:100vh;max-width:720px;margin:0 auto;padding:0 16px">

    <!-- Header -->
    <div style="padding:12px 0;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;align-items:center">
      <strong>霍格華茲</strong>
      <span>今日剩餘：{{ usageInfo.remaining }} / {{ usageInfo.limit }} 回合</span>
    </div>

    <!-- PRO model switcher -->
    <div v-if="plan === 'PRO'" style="padding:8px 0;display:flex;gap:8px;align-items:center">
      <span style="font-size:0.85em">模型：</span>
      <button
        v-for="m in PRO_MODELS" :key="m"
        @click="switchModel(m)"
        :style="{ fontWeight: selectedModel === m ? 'bold' : 'normal', textDecoration: selectedModel === m ? 'underline' : 'none' }"
      >{{ m }}</button>
    </div>

    <!-- Narrative area -->
    <div
      ref="narrativeEl"
      style="flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:16px"
    >
      <div v-if="narrative.length === 0" style="color:#888">
        （開始輸入，進入霍格華茲……）
      </div>

      <div
        v-for="(entry, i) in narrative" :key="i"
        :style="{ marginLeft: entry.role === 'user' ? 'auto' : '0', maxWidth: '90%' }"
      >
        <div v-if="entry.role === 'user'" style="background:#f0f0f0;padding:8px 12px;border-radius:4px;white-space:pre-wrap">
          {{ entry.content }}
        </div>
        <div v-else style="white-space:pre-wrap;line-height:1.8">
          {{ entry.content }}
        </div>
      </div>

      <div v-if="sending" style="color:#888">敘事者正在書寫……</div>
    </div>

    <!-- Error -->
    <div v-if="errorMsg" style="color:red;padding:4px 0;font-size:0.9em">{{ errorMsg }}</div>

    <!-- Input area -->
    <div style="padding:12px 0;border-top:1px solid #ccc;display:flex;gap:8px">
      <textarea
        v-model="input"
        :disabled="sending || limitReached"
        :placeholder="limitReached ? '今日回合已用完，明日再繼續吧。' : '輸入你的行動……'"
        rows="3"
        style="flex:1;resize:none"
        @keydown.enter.exact.prevent="send"
      />
      <button
        @click="send"
        :disabled="sending || limitReached || !input.trim()"
        style="align-self:flex-end"
      >送出</button>
    </div>

  </div>
</template>
