<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadSettings, saveSettings } from '../data.js'

const router = useRouter()
const showAge = ref(false)

function start() {
  if (loadSettings().ageConfirmed) {
    router.push({ name: 'reading' })
    return
  }
  showAge.value = true
}

function confirmAge() {
  saveSettings({ ageConfirmed: true })
  showAge.value = false
  router.push({ name: 'reading' })
}
</script>

<template>
  <main class="home">
    <section class="hero">
      <p class="eyebrow">静夜牌</p>
      <h1>抽一张牌，<br />看看此刻的自己</h1>
      <div class="deck" aria-hidden="true">
        <div class="deck-card c3"></div>
        <div class="deck-card c2"></div>
        <div class="deck-card c1"></div>
      </div>
      <p class="lead">不用想太多，也不用想得很好。<br />先深呼吸一次，再开始。</p>
      <button class="primary" @click="start">开始自测</button>
      <p class="meta">22 张大阿卡纳 · 单张牌阵 · 约 1 分钟</p>
    </section>

    <teleport to="body">
      <transition name="fade">
        <div v-if="showAge" class="modal-mask" @click.self="showAge = false">
          <div class="modal">
            <h2>先说清楚一件事</h2>
            <p>
              这个自测面向 <strong>18 岁以上</strong> 的朋友，
              内容只用于自我觉察，不代表任何诊断或结论。
            </p>
            <div class="modal-actions">
              <button class="ghost" @click="showAge = false">先不了</button>
              <button class="primary" @click="confirmAge">我已满 18 岁</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </main>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 28px 20px;
}
.hero {
  width: 100%;
  max-width: 340px;
  text-align: center;
  animation: rise 0.7s ease both;
}
.eyebrow {
  margin: 0 0 26px;
  font-size: 12px;
  letter-spacing: 0.42em;
  color: var(--gold);
  text-indent: 0.42em;
}
h1 {
  margin: 0 0 34px;
  font-size: 27px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: 0.03em;
}
.deck {
  position: relative;
  width: 132px;
  height: 208px;
  margin: 0 auto 36px;
}
.deck-card {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  border: 1px solid rgba(216, 178, 106, 0.5);
  background:
    radial-gradient(circle at 50% 30%, rgba(216, 178, 106, 0.22), transparent 62%),
    linear-gradient(160deg, #241d44, #141024 70%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}
.deck-card::after {
  content: '✦';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: rgba(216, 178, 106, 0.65);
}
.c1 { transform: rotate(-4deg); }
.c2 { transform: rotate(3deg) translateY(-4px); }
.c3 { transform: rotate(9deg) translate(6px, -2px); opacity: 0.6; }
.lead {
  margin: 0 0 30px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
}
.primary {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #e0bd78, #c39b4f);
  color: #1b1526;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1em;
  transition: transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 10px 28px rgba(216, 178, 106, 0.18);
}
.primary:active {
  transform: scale(0.985);
}
.meta {
  margin: 18px 0 0;
  font-size: 11px;
  color: var(--muted);
  opacity: 0.7;
}
.modal-mask {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(8, 6, 16, 0.72);
  backdrop-filter: blur(6px);
  z-index: 10;
}
.modal {
  width: 100%;
  max-width: 320px;
  padding: 26px 22px 22px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: linear-gradient(170deg, #201a3a, #141024);
  text-align: left;
}
.modal h2 {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 500;
}
.modal p {
  margin: 0 0 22px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--muted);
}
.modal p strong {
  color: var(--gold);
  font-weight: 500;
}
.modal-actions {
  display: flex;
  gap: 10px;
}
.modal-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 13px;
}
.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
</style>
