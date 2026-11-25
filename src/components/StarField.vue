<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 星空层：银河带 + 星点闪烁 + 偶尔流星 + 轻微视差
 * - 全部程序化绘制，不依赖任何外部图片
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
let nextMeteor = 90
let ticks = 0
let reduceMotion = false
let pointerX = 0
let pointerY = 0

const ANG = -0.46

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
  const count = Math.round((el.clientWidth * el.clientHeight) / 3400)

  stars = Array.from({ length: count }, () => {
    const r = Math.random()
    const inBand = Math.random() < 0.62
    let x, y
    if (inBand) {
      const t = (Math.random() - 0.5) * W * 1.8
      const off = (Math.random() + Math.random() + Math.random() - 1.5) * 190 * dpr
      x = cx + ux * t + nx * off
      y = cy + uy * t + ny * off
    } else {
      x = Math.random() * W
      y = Math.random() * H
    }
    return {
      x,
      y,
      r: (r < 0.78 ? 0.55 : r < 0.95 ? 1 : 1.6) * dpr,
      a: (inBand ? 0.36 : 0.22) + Math.random() * 0.62,
      tw: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.26
    }
  })
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

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)

  for (const s of stars) {
    const flick = reduceMotion ? 0.85 : 0.55 + 0.45 * Math.sin(ticks * 0.012 * s.tw + s.ph)
    ctx.globalAlpha = Math.max(0.06, s.a * flick)
    ctx.fillStyle = s.warm ? '#e6d3ae' : '#e9e6ff'
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, 6.284)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (!reduceMotion) {
    if (--nextMeteor <= 0) {
      spawnMeteor()
      nextMeteor = 600 + Math.random() * 600 // 约 20–40 秒一颗（按 30fps 计）
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
  const el = canvasEl.value
  ctx = el.getContext('2d')
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
    <div class="sky-grain"></div>
  </div>
</template>

<style scoped>
.sky::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 240vw;
  height: 300px;
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
  will-change: transform;
}
.sky-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 72vw;
  height: 72vw;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(201, 168, 106, 0.09), transparent 62%);
  filter: blur(6px);
}
.sky-grain {
  position: absolute;
  inset: 0;
  opacity: 0.05;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>");
}
</style>
