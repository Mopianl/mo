<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { submitPassword } from '../api.js'

const router = useRouter()
const password = ref('')
const busy = ref(false)
const error = ref('')
const shake = ref(false)

const MESSAGES = {
  WRONG_PASSWORD: '口令不对，再想想？',
  RATE_LIMITED: '试错次数有点多，稍等一会儿再试',
  CONFIG_MISSING: '站点还没配置口令，请联系我',
  NETWORK: '网络不通，检查一下再试',
  ERROR: '出了点小问题，再试一次'
}

async function onSubmit() {
  if (busy.value) return
  const value = password.value.trim()
  if (!value) {
    error.value = '先输入口令'
    return
  }
  busy.value = true
  error.value = ''
  const res = await submitPassword(value)
  busy.value = false
  if (res.ok) {
    router.replace({ name: 'home' })
    return
  }
  error.value = MESSAGES[res.code] || MESSAGES.ERROR
  shake.value = true
  setTimeout(() => (shake.value = false), 420)
}
</script>

<template>
  <main class="gate">
    <section class="gate-box" :class="{ shake }">
      <p class="eyebrow">静夜牌</p>
      <h1>先说一句悄悄话</h1>
      <p class="lead">这是内部测试版，输入邀请口令就能进去。</p>

      <form class="gate-form" @submit.prevent="onSubmit">
        <input
          v-model="password"
          type="password"
          inputmode="text"
          autocomplete="current-password"
          maxlength="32"
          placeholder="输入口令"
          aria-label="访问口令"
          :disabled="busy"
        />
        <button type="submit" v-float="{ lift: 4, range: 120 }" :disabled="busy || !password.trim()">
          {{ busy ? '核对中…' : '进入' }}
        </button>
      </form>

      <p v-if="error" class="gate-error" role="alert">{{ error }}</p>
      <p class="gate-hint">口令由邀请人直接告诉你，不会出现在任何页面上。</p>
    </section>
  </main>
</template>

<style scoped>
.gate {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 32px 24px;
  position: relative;
  overflow: hidden;
}
.gate-box {
  width: 100%;
  max-width: 340px;
  text-align: center;
  animation: rise 0.6s ease both;
}
.gate-box.shake {
  animation: shake 0.4s ease;
}
.eyebrow {
  margin: 0 0 18px;
  font-size: 12px;
  letter-spacing: 0.4em;
  color: var(--gold);
  text-indent: 0.4em;
}
h1 {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.lead {
  margin: 0 0 28px;
  font-size: 13px;
  color: var(--muted);
}
.gate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-size: 16px;
  letter-spacing: 0.12em;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}
input:focus {
  border-color: var(--gold);
}
button {
  padding: 14px 16px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #d3b077, #b08d4e);
  color: #1b1526;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  transition: opacity 0.2s, transform 0.15s;
}
button:disabled {
  opacity: 0.45;
}
button:active:not(:disabled) {
  transform: scale(0.98);
}
.gate-error {
  margin: 16px 0 0;
  font-size: 13px;
  color: #e79c9c;
}
.gate-hint {
  margin: 26px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--muted);
  opacity: 1;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>
