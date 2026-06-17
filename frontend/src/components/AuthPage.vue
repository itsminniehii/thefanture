<script setup>
import { ref } from 'vue';
import { auth } from '../api.js';

const emit = defineEmits(['logged-in']);

const mode     = ref('login');   // 'login' | 'register'
const email    = ref('');
const password = ref('');
const error    = ref('');
const loading  = ref(false);

async function submit() {
  error.value   = '';
  loading.value = true;
  try {
    const data = mode.value === 'login'
      ? await auth.login(email.value, password.value)
      : await auth.register(email.value, password.value);
    emit('logged-in', { token: data.token, plan: data.plan });
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div style="max-width:360px;margin:80px auto;padding:24px;border:1px solid #ccc">
    <h2>{{ mode === 'login' ? '登入' : '註冊' }}</h2>
    <form @submit.prevent="submit">
      <div style="margin-bottom:12px">
        <label>電子郵件<br>
          <input v-model="email" type="email" required style="width:100%">
        </label>
      </div>
      <div style="margin-bottom:12px">
        <label>密碼<br>
          <input v-model="password" type="password" required style="width:100%">
        </label>
      </div>
      <div v-if="error" style="color:red;margin-bottom:8px">{{ error }}</div>
      <button type="submit" :disabled="loading" style="width:100%">
        {{ loading ? '請稍候……' : (mode === 'login' ? '登入' : '註冊') }}
      </button>
    </form>
    <p style="margin-top:16px;text-align:center">
      <a href="#" @click.prevent="mode = mode === 'login' ? 'register' : 'login'">
        {{ mode === 'login' ? '還沒有帳號？前往註冊' : '已有帳號？前往登入' }}
      </a>
    </p>
  </div>
</template>
