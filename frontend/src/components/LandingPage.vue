<script setup>
import { ref } from 'vue';

const emit = defineEmits(['enter']);

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
// Reduced motion: doors begin open (brief: "門直接是開的").
const opened = ref(reduced);
let done = false;

function push() {
  if (opened.value) return;
  opened.value = true;
  // Proceed once the leaves have swung clear.
  window.setTimeout(finish, 1500);
}
function finish() {
  if (done) return;
  done = true;
  emit('enter');
}
</script>

<template>
  <div class="scene" :class="{ opened, reduced }">
    <!-- Study revealed behind the doors. SVG is tiny; still deferred from LCP. -->
    <img class="study" src="/textures/study-bg.svg" alt="" aria-hidden="true"
         loading="lazy" decoding="async" />

    <!-- Masthead -->
    <header class="mast">
      <h1 class="wordmark">The Fanture</h1>
      <img class="divider" src="/textures/filigree-divider.svg" alt="" aria-hidden="true" />
      <p class="subtitle">你的故事在門後</p>
    </header>

    <!-- Arched double doors -->
    <div class="portal">
      <button
        class="doors"
        type="button"
        :aria-label="opened ? '門已開啟' : '輕觸推開雙門'"
        :disabled="opened"
        @click="push"
      >
        <!-- Fanlight arch with radiating muntins + warm glow behind -->
        <div class="fanlight" aria-hidden="true">
          <span class="glow"></span>
          <span class="muntins">
            <i v-for="n in 7" :key="n" :style="{ '--i': n - 1 }"></i>
          </span>
        </div>

        <!-- The two leaves -->
        <div class="leaves">
          <span class="lightleak" aria-hidden="true"></span>

          <div class="leaf left" aria-hidden="true">
            <div class="panel">
              <img class="corner tl" src="/textures/filigree-corner.svg" alt="" />
              <img class="corner br" src="/textures/filigree-corner.svg" alt="" />
            </div>
            <span class="ring"></span>
          </div>

          <div class="leaf right" aria-hidden="true">
            <div class="panel">
              <img class="corner tl" src="/textures/filigree-corner.svg" alt="" />
              <img class="corner br" src="/textures/filigree-corner.svg" alt="" />
            </div>
            <span class="ring"></span>
          </div>
        </div>
      </button>
    </div>

    <p class="hint" :class="{ gone: opened }">輕觸推開</p>
  </div>
</template>

<style scoped>
.scene {
  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: clamp(14px, 4vh, 28px);
  padding: clamp(28px, 7vh, 56px) 20px 28px;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% 30%, rgba(var(--candle), 0.10), transparent 60%),
    var(--bg);
}

/* revealed study */
.study {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 1.4s ease 0.4s;
  pointer-events: none;
  z-index: 0;
}
.scene.opened .study { opacity: 1; }

/* masthead */
.mast {
  position: relative;
  z-index: 5;
  text-align: center;
  transition: opacity 0.9s ease, transform 0.9s ease;
}
.wordmark {
  font-family: var(--font-wordmark);
  font-weight: 900;
  font-size: clamp(2.4rem, 13vw, 3.4rem);
  letter-spacing: 0.01em;
  margin: 0;
  color: var(--gilt);
  text-shadow: 0 0 26px rgba(var(--candle), 0.28), 0 1px 0 rgba(0, 0, 0, 0.5);
}
.divider {
  display: block;
  width: clamp(180px, 62vw, 300px);
  margin: 10px auto 6px;
  opacity: 0.9;
}
.subtitle {
  font-family: var(--font-cjk);
  font-weight: 500;
  font-size: clamp(0.95rem, 4.2vw, 1.1rem);
  letter-spacing: 0.42em;
  text-indent: 0.42em;
  margin: 0;
  color: var(--muted);
}

/* portal sets the 3D camera */
.portal {
  position: relative;
  z-index: 2;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1500px;
  width: 100%;
  padding-top: clamp(48px, 11vh, 96px);
}
.doors {
  position: relative;
  width: min(78vw, 320px);
  height: min(64vh, 460px);
  padding: 0;
  border: 0;
  background: transparent;
  transform-style: preserve-3d;
}
.doors:disabled { cursor: default; }
.doors:focus-visible { outline: 2px solid var(--gilt); outline-offset: 8px; border-radius: 6px; }

/* fanlight */
.fanlight {
  position: absolute;
  left: 50%;
  top: 0;
  width: 112%;
  height: 28%;
  transform: translateX(-50%) translateY(-86%);
  border-top-left-radius: 100% 180%;
  border-top-right-radius: 100% 180%;
  background:
    linear-gradient(#1d150d, #160f09);
  border: 2px solid var(--wood-dark);
  border-bottom: none;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(154, 125, 68, 0.25);
}
.fanlight .glow {
  position: absolute;
  left: 50%;
  bottom: -40%;
  width: 90%;
  height: 150%;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(var(--candle), 0.6), rgba(var(--candle), 0.12) 60%, transparent 75%);
}
.fanlight .muntins {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 100%;
  height: 100%;
  transform: translateX(-50%);
}
.fanlight .muntins i {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 2px;
  height: 96%;
  background: var(--wood-dark);
  transform-origin: bottom center;
  transform: rotate(calc((var(--i) - 3) * 21deg));
}

/* leaves */
.leaves {
  position: absolute;
  inset: 0;
  display: flex;
  border: 3px solid var(--wood-dark);
  box-shadow: inset 0 0 0 1px rgba(154, 125, 68, 0.3), 0 24px 60px rgba(0, 0, 0, 0.6);
  background: var(--bg-deep);
}
.lightleak {
  position: absolute;
  left: 50%;
  top: 4%;
  width: 10px;
  height: 92%;
  transform: translateX(-50%);
  background: linear-gradient(rgba(var(--candle), 0.0), rgba(var(--candle), 0.5) 30%, rgba(var(--candle), 0.5) 70%, rgba(var(--candle), 0.0));
  filter: blur(3px);
  z-index: 0;
}
.leaf {
  position: relative;
  width: 50%;
  height: 100%;
  background-image: url('/textures/oak.svg');
  background-size: cover;
  background-position: center;
  transition: transform 1.5s cubic-bezier(0.22, 0.68, 0.18, 1);
  z-index: 1;
  backface-visibility: hidden;
}
.leaf.left  { transform-origin: left center;  border-right: 1px solid rgba(0,0,0,0.5); }
.leaf.right { transform-origin: right center; border-left: 1px solid rgba(0,0,0,0.5); }

.scene.opened .leaf.left  { transform: rotateY(-110deg); }
.scene.opened .leaf.right { transform: rotateY(110deg); }

/* faded green panel inset with gilt corners */
.panel {
  position: absolute;
  inset: 12% 14%;
  background-image: url('/textures/panel-green.svg');
  background-size: cover;
  border: 1px solid rgba(154, 125, 68, 0.4);
  box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.5);
}
.corner { position: absolute; width: 38px; height: 38px; opacity: 0.85; }
.corner.tl { top: 5px; left: 5px; }
.corner.br { bottom: 5px; right: 5px; transform: rotate(180deg); }

/* brass ring handles near the centre seam */
.ring {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 22px;
  border: 3px solid var(--brass);
  border-radius: 50%;
  transform: translateY(-50%);
  box-shadow: 0 1px 2px rgba(0,0,0,0.6), inset 0 0 4px rgba(0,0,0,0.5);
}
.leaf.left  .ring { right: 12px; }
.leaf.right .ring { left: 12px; }

/* bottom hint */
.hint {
  position: relative;
  z-index: 2;
  font-family: var(--font-cjk);
  font-size: 0.9rem;
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: var(--faint);
  margin: 0;
  transition: opacity 0.7s ease;
}
.hint.gone { opacity: 0; }

/* candle flicker, motion-gated, opacity-only */
@media (prefers-reduced-motion: no-preference) {
  .fanlight .glow { animation: flicker 4.5s ease-in-out infinite; }
  .lightleak { animation: flicker 4.5s ease-in-out infinite; }
}
@keyframes flicker {
  0%, 100% { opacity: 1; }
  45%      { opacity: 0.82; }
  70%      { opacity: 0.92; }
}

/* reduced motion: doors already open, no swing */
.scene.reduced .leaf { transition: none; }
.scene.reduced .study { transition: none; opacity: 1; }
</style>
