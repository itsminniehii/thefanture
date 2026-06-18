<script setup>
import { ref } from 'vue';
import LandingPage from './components/LandingPage.vue';
import AuthPage from './components/AuthPage.vue';
import GamePage from './components/GamePage.vue';

const token   = ref('');
const plan    = ref('');
const entered = ref(false); // doors pushed open

function onLoggedIn({ token: t, plan: p }) {
  token.value = t;
  plan.value  = p;
}
</script>

<template>
  <LandingPage v-if="!token && !entered" @enter="entered = true" />
  <AuthPage v-else-if="!token" @logged-in="onLoggedIn" />
  <GamePage v-else :token="token" :plan="plan" />
</template>
