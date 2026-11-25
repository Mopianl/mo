<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cardImage, drawCard, loadSettings } from '../data.js'
import { streamReading } from '../api.js'
import { draft } from '../state.js'

const router = useRouter()
const drawn = ref(null)
const flipped = ref(false)
const reduceMotion = ref(false)

const text = ref('')
const streaming = ref(false)
const degraded = ref(false)
const started = ref(false)
const errorMsg = ref('')
const crisis = ref(false)

const card = computed(() => drawn.value?.card || null)
const orientation = computed(() => drawn.value?.orientation || 'upright')
const isReversed = computed(() => orientation.value === 'reversed')

const keywords = computed(() =>
  card.value ? card.value.keywords[orientation.value] : []
)
const meaning = computed(() =>
  card.value ? card.value.meaning[orientation.value] : ''
)

/** 把「## 小标题」渲染成小标题，其余按段落 */
const blocks = computed(() =>
  text.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('## ') ? { type: 'h', text: line.slice(3) } : { type: 'p', text: line }
    )
)

onMounted(() => {
  reduceMotion.value = loadSettings().reduceMotion
  drawn.value = drawCard()
  // 等一帧再翻，保证过渡动画能看到
  requestAnimationFrame(() => setTimeout(() => (flipped.value = true), 60))
})

/** 再抽一张：同一路由内重开，不跳转（push 同一路由不会重新挂载） */
function drawAgain() {
  started.value = false
  streaming.value = false
  degraded.value = false
  crisis.value = false
  errorMsg.value = ''
  text.value = ''
  flipped.value = false
  drawn.value = drawCard()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  requestAnimationFrame(() => setTimeout(() => (flipped.value = true), 80))
}

function fallbackText() {
  return `【${card.value.nameZh} · ${isReversed.value ? '逆位' : '正位'}】\n\n${meaning.value}`
}

async function viewReading() {
  if (started.value) return
  started.value = true
  streaming.value = true
  text.value = ''
  errorMsg.value = ''
  const payload = {
    cardId: card.value.id,
    orientation: orientation.value,
    userNote: draft.note.trim(),
    locale: 'zh-CN'
  }
  try {
    const result = await streamReading(payload, (delta) => {
      text.value += delta
    })
    if (result.safety?.level === 'crisis') {
      crisis.value = true
    }
  } catch (err) {
    degraded.value = true
    if (err.partial) text.value = err.partial
    if (err.code === 'UPSTREAM_TIMEOUT') {
      errorMsg.value = 'AI 那边有点慢，先看牌面本身吧'
    } else if (err.code === 'NOT_IMPLEMENTED' || err.code === 'UPSTREAM_ERROR') {
      errorMsg.value = 'AI 解读还在接，先看牌面本身吧'
    } else if (err.code === 'UNAUTHORIZED') {
      errorMsg.value = '登录状态失效了，回首页重新进入'
    } else if (err.code === 'INVALID_INPUT') {
      errorMsg.value = '这张牌没抽好，退回去再抽一次'
    } else {
      errorMsg.value = '网络不太稳，给你一个简版'
    }
    if (!text.value) text.value = fallbackText()
  }
  streaming.value = false
}
</script>

<template>
  <main v-if="card" class="reading">
    <button class="back" @click="router.push({ name: 'home' })" aria-label="返回">‹</button>

    <section class="stage" v-float="{ lift: 7, range: 220 }">
      <div class="card-shell" :class="{ flipped, reversed: isReversed && flipped }">
        <div class="card-face card-back">
          <span>✦</span>
        </div>
        <div class="card-face card-front">
          <img :src="cardImage(card.id)" :alt="card.nameZh" draggable="false" />
        </div>
      </div>
    </section>

    <section class="info" :class="{ show: flipped }">
      <p class="pos">{{ isReversed ? '逆位' : '正位' }}</p>
      <h1>{{ card.nameZh }}</h1>
      <p class="en">{{ card.nameEn }}</p>
      <ul class="keywords">
        <li v-for="k in keywords" :key="k">{{ k }}</li>
      </ul>

      <button v-if="!started" class="primary" v-float="{ lift: 5, range: 140 }" @click="viewReading">查看解读</button>
      <template v-else>
        <p v-if="errorMsg" class="note">{{ errorMsg }}</p>
        <div class="reading-text" :class="{ typing: streaming }">
          <template v-for="(block, i) in blocks" :key="i">
            <h3 v-if="block.type === 'h'" class="section">{{ block.text }}</h3>
            <p v-else>{{ block.text }}</p>
          </template>
          <span v-if="streaming" class="caret"></span>
        </div>
        <p v-if="!crisis" class="disclaimer">
          本内容由 AI 生成，仅供娱乐与自我觉察参考，不构成任何诊断或建议。
          如有持续困扰，请与信任的人聊聊，或联系专业心理支持。
        </p>
        <button class="ghost" @click="drawAgain">再抽一张</button>
      </template>
    </section>
  </main>
</template>

<style scoped>
.reading {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 24px 8px;
  animation: rise 0.5s ease both;
}
.back {
  align-self: flex-start;
  width: 34px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 26px;
  line-height: 1;
  padding: 0 0 4px;
  text-align: left;
}
.stage {
  position: relative;
  display: grid;
  place-items: center;
  padding: 8px 0 26px;
  perspective: 1200px;
}
/* 背后光晕 + 地面柔光：给牌面一点体积感 */
.stage::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 78vw;
  max-width: 300px;
  height: 78vw;
  max-height: 300px;
  z-index: 0;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    rgba(150, 120, 200, 0.2),
    rgba(201, 168, 106, 0.09) 58%,
    transparent 74%
  );
  filter: blur(12px);
  pointer-events: none;
}
.stage::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 12px;
  width: 62vw;
  max-width: 240px;
  height: 34px;
  z-index: 0;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(201, 168, 106, 0.16), transparent 72%);
  filter: blur(8px);
  pointer-events: none;
}
.card-shell {
  position: relative;
  z-index: 1;
  width: min(58vw, 210px);
  aspect-ratio: 0.585;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.22, 0.85, 0.24, 1);
}
.card-shell.flipped {
  transform: rotateY(180deg);
}
.card-face {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  overflow: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.card-back {
  display: grid;
  place-items: center;
  font-size: 30px;
  color: rgba(216, 178, 106, 0.7);
  border: 1px solid rgba(216, 178, 106, 0.5);
  background:
    radial-gradient(circle at 50% 32%, rgba(216, 178, 106, 0.2), transparent 62%),
    linear-gradient(160deg, #241d44, #141024 70%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
}
.card-front {
  transform: rotateY(180deg);
  background: #17122a;
}
.card-front img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 10px;
  transition: transform 0.7s ease;
}
.card-shell.reversed .card-front img {
  transform: rotate(180deg);
}
.info {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s;
}
.info.show {
  opacity: 1;
  transform: none;
}
.pos {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--gold);
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 0.06em;
}
.en {
  margin: 4px 0 16px;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--muted);
  text-transform: uppercase;
}
.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 26px;
  padding: 0;
  list-style: none;
}
.keywords li {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 12px;
  color: #cfc6e4;
}
.primary {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #d3b077, #b08d4e);
  color: #1b1526;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1em;
  box-shadow: 0 10px 28px rgba(216, 178, 106, 0.18);
}
.primary:active {
  transform: scale(0.985);
}
.note {
  margin: 0 0 12px;
  font-size: 11px;
  color: var(--muted);
}
.reading-text {
  font-size: 14px;
  line-height: 2;
  color: #ded8ee;
  white-space: pre-wrap;
}
.reading-text p {
  margin: 0 0 14px;
}
.reading-text .section {
  margin: 22px 0 10px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: var(--gold);
}
.reading-text .section:first-child {
  margin-top: 0;
}
.caret {
  display: inline-block;
  width: 7px;
  height: 15px;
  margin-left: 2px;
  background: var(--gold);
  vertical-align: -2px;
  animation: blink 1s steps(2) infinite;
}
.disclaimer {
  margin: 26px 0 20px;
  font-size: 11px;
  line-height: 1.8;
  color: var(--muted);
  opacity: 1;
}
.ghost {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  letter-spacing: 0.08em;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
