/**
 * v-float：鼠标靠近 / 手指按在附近时，元素轻轻抬起一下
 * 用法：v-float            → 默认抬 6px
 *      v-float="{ lift: 10, range: 200 }"
 * 只在元素周围 range 像素内才触发，位置基本不动，只是轻抬 + 阴影加重。
 */
const STATE = new WeakMap()

function bind(el, opts) {
  const lift = opts?.lift ?? 6
  const range = opts?.range ?? 170

  const onMove = (e) => {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const d = Math.hypot(e.clientX - cx, e.clientY - cy)
    const near = d < Math.max(range, Math.max(r.width, r.height) / 2)
    el.classList.toggle('is-floating', near)
  }

  const onTouch = () => {
    el.classList.add('is-floating')
    setTimeout(() => el.classList.remove('is-floating'), 420)
  }

  el.style.setProperty('--float-lift', `${lift}px`)
  el.classList.add('floatable')

  window.addEventListener('pointermove', onMove, { passive: true })
  el.addEventListener('touchstart', onTouch, { passive: true })

  STATE.set(el, { onMove, onTouch })
}

function unbind(el) {
  const s = STATE.get(el)
  if (!s) return
  window.removeEventListener('pointermove', s.onMove)
  el.removeEventListener('touchstart', s.onTouch)
  STATE.delete(el)
}

export default {
  mounted(el, binding) {
    bind(el, binding.value)
  },
  updated(el, binding) {
    unbind(el)
    bind(el, binding.value)
  },
  unmounted(el) {
    unbind(el)
  }
}
