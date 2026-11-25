<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 星空层：银河带 + 白尘 + 三档星点（大星带芒 / 中星 / 微星）+ 呼吸星 + 流星
 * - 全程程序化绘制，不依赖外部图片
 * - 30fps 上限、页面隐藏时暂停、系统「减少动效」时只画静态一帧
 */
const canvasEl = ref(null)

let ctx = null
let stars = []
let meteors = []
let W = 0
let H = 0
let dpr = 1
let raf = 0
let running = true
let lastDraw = 0
let nextMeteor = 600
let ticks = 0
let reduceMotion = false
let pointerX = 0
let pointerY = 0

const ANG = -0.46
const BREATH_PERIOD = 108 // 约 3.6 秒（30fps 下）

function build() {
  const el = canvasEl.value
  if (!el) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = el.clientWidth * dpr
  H = el.clientHeight * dpr
  el.width = W
  el.height = H

  const cx = W * 0.5
  const cy = H * 0.46
  const ux = Math.cos(ANG)
  const uy = Math.sin(ANG)
  const nx = -uy
  const ny = ux

  // 数量比上一版多约 80%：微星点撑密度，视觉重量靠尺寸差控制
  const count = Math.round((el.clientWidth * el.clientHeight) / 1900)

  const place = (inBand) => {
    if (inBand) {
      const t = (Math.random() - 0.5) * W * 1.8
      const off = (Math.random() + Math.random() + Math.random() - 1.5) * 190 * dpr
      return [cx + ux * t + nx * off, cy + uy * t + ny * off]
    }
    return [Math.random() * W, Math.random() * H]
  }

  stars = []
  for (let i = 0; i < count; i++) {
    const inBand = Math.random() < 0.58
    const [x, y] = place(inBand)
    const roll = Math.random()
    // 三档：大星（带芒）3 颗、中星约 14%、其余为微星
    let tier = 'micro'
    if (i < 3) tier = 'big'
    else if (roll < 0.14) tier = 'mid'

    const base = tier === 'big' ? 0.92 : tier === 'mid' ? 0.6 : 0.22
    stars.push({
      x,
      y,
      tier,
      r: (tier === 'big' ? 1.6 : tier === 'mid' ? 1 : 0.55) * dpr,
      base,
      warm: Math.random() < 0.26,
      // 呼吸星：前两颗大星，相位错开半个周期
      breath: tier === 'big' && i < 2 ? (i === 0 ? 0 : BREATH_PERIOD / 2) : -1,
      tw: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2
    })
  }
}

function spawnMeteor() {
  const fromLeft = Math.random() < 0.5
  meteors.push({
    x: fromLeft ? Math.random() * W * 0.6 : W * 0.4 + Math.random() * W * 0.6,
    y: Math.random() * H * 0.42,
    len: (120 + Math.random() * 150) * dpr,
    ang: (fromLeft ? 1 : -1) * (0.3 + Math.random() * 0.18) + Math.PI / 2.6,
    life: 0,
    max: 55 + Math.random() * 25,
    speed: 9 + Math.random() * 7
  })
}

/** 四角芒：两根细渐变线，成本几乎为零但"宝石感"明显 */
function drawFlare(s, alpha) {
  const len = 9 * dpr
  for (let k = 0; k < 2; k++) {
    const x2 = k === 0 ? s.x + len : s.x
    const y2 = k === 0 ? s.y : s.y + len
    const x1 = k === 0 ? s.x - len : s.x
    const y1 = k === 0 ? s.y : s.y - len
    const g = ctx.createLinearGradient(x1, y1, x2, y2)
    g.addColorStop(0, 'rgba(255,250,240,0)')
    g.addColorStop(0.5, `rgba(255,250,240,${0.55 * alpha})`)
    g.addColorStop(1, 'rgba(255,250,240,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = 0.7 * dpr
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)

  for (const s of stars) {
    let alpha = s.base
    if (!reduceMotion) {
      if (s.breath >= 0) {
        // 呼吸星：3.6 秒一轮，0.35 → 0.95
        const p = ((ticks + s.breath) % BREATH_PERIOD) / BREATH_PERIOD
        alpha = 0.35 + 0.6 * (0.5 - 0.5 * Math.cos(p * Math.PI * 2))
      } else {
        alpha = s.base * (0.55 + 0.45 * Math.sin(ticks * 0.012 * s.tw + s.ph))
      }
    }
    ctx.globalAlpha = Math.max(0.05, alpha)
    ctx.fillStyle = s.warm ? '#e6d3ae' : '#eae7ff'
    if (s.tier === 'big') {
      // 大星：外圈柔光 + 核心 + 四角芒
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 5 * dpr)
      g.addColorStop(0, 'rgba(255,252,244,0.9)')
      g.addColorStop(1, 'rgba(255,252,244,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(s.x, s.y, 5 * dpr, 0, 6.284)
      ctx.fill()
      ctx.fillStyle = '#fffdf6'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r * 0.75, 0, 6.284)
      ctx.fill()
      ctx.globalAlpha = Math.max(0.05, alpha)
      drawFlare(s, alpha)
    } else {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, 6.284)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  if (!reduceMotion) {
    if (--nextMeteor <= 0) {
      spawnMeteor()
      nextMeteor = 600 + Math.random() * 600 // 约 20–40 秒一颗（30fps 计）
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]
      m.life++
      m.x += Math.cos(m.ang) * m.speed * dpr
      m.y += Math.sin(m.ang) * m.speed * dpr
      if (m.life > m.max) {
        meteors.splice(i, 1)
        continue
      }
      const fade = Math.sin((Math.PI * m.life) / m.max)
      const tx = m.x - Math.cos(m.ang) * m.len
      const ty = m.y - Math.sin(m.ang) * m.len
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty)
      g.addColorStop(0, `rgba(255,248,232,${0.85 * fade})`)
      g.addColorStop(1, 'rgba(255,248,232,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1.5 * dpr
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
  }
}

function loop(ts) {
  if (!running) return
  raf = requestAnimationFrame(loop)
  if (ts - lastDraw < 30) return // 约 30fps，省电
  lastDraw = ts
  ticks++
  draw()
}

function applyTransform() {
  const el = canvasEl.value
  if (!el) return
  const y = -window.scrollY * 0.15 + pointerY * 10
  const x = pointerX * 10
  el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
}

function onPointer(e) {
  pointerX = e.clientX / window.innerWidth - 0.5
  pointerY = e.clientY / window.innerHeight - 0.5
  applyTransform()
}

function onScroll() {
  applyTransform()
}

function onVisibility() {
  running = !document.hidden
  if (running) {
    lastDraw = 0
    raf = requestAnimationFrame(loop)
  } else {
    cancelAnimationFrame(raf)
  }
}

function onResize() {
  build()
  if (reduceMotion) draw()
}

onMounted(() => {
  reduceMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('reduce-motion')
  ctx = canvasEl.value.getContext('2d')
  build()
  draw()
  if (!reduceMotion) raf = requestAnimationFrame(loop)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  running = false
  cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('pointermove', onPointer)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="sky" aria-hidden="true">
    <canvas ref="canvasEl" class="sky-canvas"></canvas>
    <div class="sky-glow"></div>
    <div class="sky-fog"></div>
  </div>
</template>

<style scoped>
/* 主银河带：紫色斜带 */
.sky::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 240vw;
  height: 300px;
  z-index: 0;
  transform: translate(-50%, -50%) rotate(-26.4deg);
  background: linear-gradient(
    to bottom,
    rgba(120, 104, 186, 0) 0%,
    rgba(126, 110, 196, 0.14) 30%,
    rgba(158, 144, 214, 0.22) 50%,
    rgba(126, 110, 196, 0.14) 70%,
    rgba(120, 104, 186, 0) 100%
  );
  filter: blur(2px);
}
/* 星尘：极淡白雾，只落在画面上下两端，避开中段文字 */
.sky::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 240vw;
  height: 190px;
  z-index: 1;
  transform: translate(-50%, -50%) rotate(-26.4deg);
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  filter: blur(3px);
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 0%,
    transparent 34%,
    transparent 66%,
    #000 100%
  );
  mask-image: linear-gradient(to bottom, #000 0%, transparent 34%, transparent 66%, #000 100%);
}
.sky {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background:
    radial-gradient(60% 42% at 22% 18%, rgba(88, 70, 140, 0.34), transparent 70%),
    radial-gradient(52% 38% at 78% 30%, rgba(46, 62, 120, 0.3), transparent 72%),
    radial-gradient(70% 50% at 50% 88%, rgba(70, 48, 96, 0.26), transparent 75%),
    var(--bg);
}
.sky-canvas {
  position: absolute;
  inset: -8% 0 auto;
  width: 100%;
  height: 132%;
  z-index: 2;
  will-change: transform;
}
.sky-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 72vw;
  height: 72vw;
  z-index: 1;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(201, 168, 106, 0.09), transparent 62%);
  filter: blur(6px);
}
/* 地面雾：压住画面下沿，不至于空掉 */
.sky-fog {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 150px;
  z-index: 3;
  background: linear-gradient(to top, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0));
}
</style>
