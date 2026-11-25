// 用 CDP 截图（需要先手动启动 Edge：--remote-debugging-port=9222）
// node scripts/shot.mjs <url> <out.png> [--auth]
import fs from 'node:fs'
import crypto from 'node:crypto'

const [, , url, out, flag] = process.argv
const withAuth = flag === '--auth'

const devVars = fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
const env = Object.fromEntries(
  devVars
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)

const targets = await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9222) + '/json/list')).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, resolve)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true
})

await send('Network.enable')
if (withAuth) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const secret = env.TAROT_SECRET || env.ACCESS_PASSWORD
  const sig = crypto.createHmac('sha256', secret).update(`v1.${exp}`).digest('hex')
  await send('Network.setCookie', {
    name: 'tarot_pass',
    value: `${exp}.${sig}`,
    url: 'http://127.0.0.1:8788/',
    path: '/',
    httpOnly: true
  })
}

if (!withAuth) await send('Network.clearBrowserCookies')
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 1200))
if (withAuth) await send('Page.reload', { ignoreCache: false })
await new Promise((r) => setTimeout(r, 2600))
const state = await send('Runtime.evaluate', { expression: 'location.hash', returnByValue: true })
console.log('landed on', state.result?.result?.value)
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log('saved', out, fs.statSync(out).size, 'bytes')
ws.close()
