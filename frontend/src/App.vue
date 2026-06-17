<script setup>
import { ref } from 'vue';
import AuthPage from './components/AuthPage.vue';
import GamePage from './components/GamePage.vue';

const token = ref('');
const plan  = ref('');

function onLoggedIn({ token: t, plan: p }) {
  token.value = t;
  plan.value  = p;
}
</script>

<template>
  <AuthPage v-if="!token" @logged-in="onLoggedIn" />
  <GamePage v-else :token="token" :plan="plan" />
</template>
