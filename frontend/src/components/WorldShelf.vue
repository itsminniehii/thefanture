<script setup>
defineProps({
  worlds: { type: Array, required: true },
});

const emit = defineEmits(['select']);

function choose(world) {
  if (!world.available) return;
  emit('select', world.id);
}
</script>

<template>
  <div class="shelf">
    <header class="shelf-header">
      <h2 class="shelf-title">選擇你的世界</h2>
      <p class="shelf-lead">從書架取下一冊，翻開便是入口。</p>
    </header>

    <ul class="shelf-grid">
      <li v-for="world in worlds" :key="world.id">
        <button
          type="button"
          class="book"
          :class="{ 'book-locked': !world.available }"
          :disabled="!world.available"
          :aria-disabled="!world.available"
          @click="choose(world)"
        >
          <span class="book-spine" aria-hidden="true"></span>
          <span class="book-body">
            <span class="book-title">{{ world.title }}</span>
            <span class="book-desc">{{ world.description }}</span>
            <span v-if="!world.available" class="book-tag">即將開放</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.shelf {
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(28px, 6vh, 48px) 20px;
}

.shelf-header {
  text-align: center;
  margin-bottom: clamp(20px, 4vh, 32px);
}

.shelf-title {
  font-family: var(--font-wordmark);
  font-weight: 700;
  font-size: clamp(1.5rem, 5vw, 1.85rem);
  color: var(--gilt);
  margin: 0 0 10px;
  letter-spacing: 0.04em;
}

.shelf-lead {
  font-family: var(--font-cjk);
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--muted);
  margin: 0;
}

.shelf-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.book {
  position: relative;
  display: flex;
  width: 100%;
  text-align: left;
  padding: 0;
  border: 1px solid rgba(154, 125, 68, 0.45);
  border-radius: 4px;
  background: var(--parchment);
  color: var(--ink);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  transition: transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.book:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--gilt);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.36);
}

.book:focus-visible {
  outline: none;
  border-color: var(--gilt-bright);
}

.book-spine {
  flex: 0 0 14px;
  background: linear-gradient(var(--panel-green), var(--wood-dark));
  border-right: 1px solid rgba(154, 125, 68, 0.4);
}

.book-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 18px 20px;
}

.book-title {
  font-family: var(--font-wordmark);
  font-size: 1.2rem;
  letter-spacing: 0.04em;
  color: var(--ink);
}

.book-desc {
  font-family: var(--font-cjk);
  font-size: 0.9rem;
  line-height: 1.7;
  color: rgba(46, 36, 26, 0.72);
}

.book-tag {
  align-self: flex-start;
  font-family: var(--font-latin);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: var(--faint);
  border: 1px solid rgba(126, 102, 56, 0.5);
  border-radius: 999px;
  padding: 2px 10px;
}

.book-locked {
  cursor: not-allowed;
  background: rgba(230, 217, 189, 0.5);
  box-shadow: none;
  filter: saturate(0.7);
}

.book-locked .book-spine {
  background: linear-gradient(var(--wood), var(--wood-dark));
  opacity: 0.7;
}

.book-locked .book-title,
.book-locked .book-desc {
  opacity: 0.7;
}
</style>
