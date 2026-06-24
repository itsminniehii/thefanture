<script setup>
import { ref, watch, onMounted } from 'vue';
import { settingPacks } from '../api.js';

const LIMITS = {
  playerBackground: 1000,
  customCharacters: 2000,
};

const props = defineProps({
  worldId:     { type: String, required: true },
  token:       { type: String, required: true },
  submitLabel: { type: String, default: '進入遊戲' },
});

const emit = defineEmits(['saved', 'skip']);

const playerBackground = ref('');
const customCharacters = ref('');
const loading          = ref(false);
const saving           = ref(false);
const rawPack          = ref(null);
const loadError        = ref('');
const saveError        = ref('');

function applyPack(pack) {
  rawPack.value          = pack;
  playerBackground.value = pack?.playerBackground ?? '';
  customCharacters.value = pack?.customCharacters ?? '';
}

async function load() {
  loadError.value = '';
  loading.value   = true;
  try {
    const data = await settingPacks.get(props.token, props.worldId);
    applyPack(data.pack ?? null);
  } catch {
    applyPack(null);
    loadError.value = '設定載入失敗，仍可略過或直接進入遊戲。';
  } finally {
    loading.value = false;
  }
}

function trimmedFields() {
  return {
    playerBackground: playerBackground.value.trim(),
    customCharacters: customCharacters.value.trim(),
  };
}

function skip() {
  emit('skip');
}

async function submit() {
  saveError.value = '';
  const { playerBackground: bg, customCharacters: chars } = trimmedFields();

  if (!bg && !chars) {
    emit('skip');
    return;
  }

  saving.value = true;
  try {
    await settingPacks.update(props.token, props.worldId, {
      ...rawPack.value,
      playerBackground: bg || null,
      customCharacters: chars || null,
    });
    emit('saved');
  } catch (e) {
    saveError.value = e.message ?? '儲存失敗，請稍後再試。';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => props.worldId, load);
</script>

<template>
  <div class="pack-form">
    <header class="pack-header">
      <h2 class="pack-title">開局前設定</h2>
      <p class="pack-lead">可選填。留空也能直接進入故事；填寫後會成為你在這個世界的私人補丁。</p>
    </header>

    <p v-if="loadError" class="notice notice-warn" role="status">{{ loadError }}</p>
    <p v-if="loading" class="notice" role="status">載入設定中……</p>

    <form class="pack-fields" @submit.prevent="submit">
      <label class="field">
        <span class="field-label">玩家在這個世界的身分</span>
        <textarea
          v-model="playerBackground"
          class="field-input"
          rows="4"
          :maxlength="LIMITS.playerBackground"
          :disabled="loading || saving"
          placeholder="例如：剛收到錄取通知的麻瓜出身新生……"
        />
        <span class="field-count">{{ playerBackground.length }} / {{ LIMITS.playerBackground }}</span>
      </label>

      <label class="field">
        <span class="field-label">這個世界的自訂角色</span>
        <textarea
          v-model="customCharacters"
          class="field-input"
          rows="5"
          :maxlength="LIMITS.customCharacters"
          :disabled="loading || saving"
          placeholder="例如：你的寵物貓頭鷹、某位尚未登場的親友……"
        />
        <span class="field-count">{{ customCharacters.length }} / {{ LIMITS.customCharacters }}</span>
      </label>

      <p v-if="saveError" class="notice notice-error" role="alert">{{ saveError }}</p>

      <div class="actions">
        <button type="button" class="btn btn-ghost" :disabled="loading || saving" @click="skip">
          略過
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading || saving">
          {{ saving ? '儲存中……' : submitLabel }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.pack-form {
  max-width: 560px;
  margin: 0 auto;
  padding: clamp(28px, 6vh, 48px) 20px;
}

.pack-header {
  text-align: center;
  margin-bottom: clamp(20px, 4vh, 32px);
}

.pack-title {
  font-family: var(--font-wordmark);
  font-weight: 700;
  font-size: clamp(1.5rem, 5vw, 1.85rem);
  color: var(--gilt);
  margin: 0 0 10px;
  letter-spacing: 0.04em;
}

.pack-lead {
  font-family: var(--font-cjk);
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--muted);
  margin: 0;
}

.notice {
  font-size: 0.9rem;
  text-align: center;
  margin: 0 0 16px;
  color: var(--faint);
}

.notice-warn {
  color: var(--gilt-bright);
}

.notice-error {
  color: #c46a5a;
}

.pack-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-family: var(--font-cjk);
  font-size: 0.95rem;
  color: var(--parchment-2);
  letter-spacing: 0.06em;
}

.field-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(154, 125, 68, 0.45);
  border-radius: 4px;
  background: var(--parchment);
  color: var(--ink);
  font-family: var(--font-cjk);
  font-size: 0.95rem;
  line-height: 1.7;
  resize: vertical;
  min-height: 96px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: border-color 0.2s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--gilt);
}

.field-input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.field-input::placeholder {
  color: rgba(46, 36, 26, 0.45);
}

.field-count {
  align-self: flex-end;
  font-family: var(--font-latin);
  font-size: 0.8rem;
  color: var(--faint);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.btn {
  font-family: var(--font-cjk);
  font-size: 0.95rem;
  padding: 10px 20px;
  border-radius: 4px;
  border: 1px solid transparent;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  border-color: rgba(154, 125, 68, 0.35);
  color: var(--muted);
}

.btn-ghost:hover:not(:disabled) {
  border-color: var(--gilt);
  color: var(--parchment-2);
}

.btn-primary {
  background: var(--panel-green);
  border-color: rgba(154, 125, 68, 0.5);
  color: var(--parchment);
}

.btn-primary:hover:not(:disabled) {
  background: #3f4a44;
  border-color: var(--gilt);
}
</style>
