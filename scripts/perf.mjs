// 帧耗时实测：注入页面测 3 秒 rAF 间隔
import fs from 'node:fs'
import crypto from 'node:crypto'

const devVars = fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
const env = Object.fromEntries(
  devVars.split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const port = process.env.CDP_PORT || 9222
const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
}
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id; pending.set(mid, resolve)
  ws.send(JSON.stringify({ id: mid, method, params }))
})

await send('Page.enable')
await send('Network.enable')
const exp = Math.floor(Date.now() / 1000) + 3600
const secret = env.TAROT_SECRET || env.ACCESS_PASSWORD
const sig = crypto.createHmac('sha256', secret).update(`v1.${exp}`).digest('hex')
await send('Network.setCookie', {
  name: 'tarot_pass', value: `${exp}.${sig}`,
  url: 'http://127.0.0.1:8788/', path: '/', httpOnly: true
})
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Page.navigate', { url: 'http://127.0.0.1:8788/#/' })
await new Promise((r) => setTimeout(r, 1500))
await send('Page.reload')
await new Promise((r) => setTimeout(r, 2500))

const r = await send('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `new Promise((resolve) => {
    const t = [];
    let last = performance.now();
    const start = last;
    function step(now) {
      t.push(now - last);
      last = now;
      if (now - start < 3000) requestAnimationFrame(step);
      else {
        t.shift();
        const sorted = [...t].sort((a, b) => a - b);
        const avg = t.reduce((a, b) => a + b, 0) / t.length;
        resolve({
          frames: t.length,
          fps: +(1000 / avg).toFixed(1),
          avgMs: +avg.toFixed(2),
          p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
          worstMs: +sorted[sorted.length - 1].toFixed(2),
          over34: t.filter((x) => x > 34).length
        });
      }
    }
    requestAnimationFrame(step);
  })`
})
console.log(JSON.stringify(r.result?.result?.value, null, 2))
ws.close()
