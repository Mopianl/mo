import fs from 'node:fs'
import crypto from 'node:crypto'

const devVars = fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
const env = Object.fromEntries(
  devVars.split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
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
const sc = await send('Network.setCookie', {
  name: 'tarot_pass',
  value: `${exp}.${sig}`,
  url: 'http://127.0.0.1:8788/',
  path: '/',
  httpOnly: true
})
console.log('setCookie:', JSON.stringify(sc.result || sc.error))

await send('Page.navigate', { url: 'http://127.0.0.1:8788/#/' })
await new Promise((r) => setTimeout(r, 2000))
const ev = await send('Runtime.evaluate', {
  expression: `(async () => { const r = await fetch('/api/gate', {credentials:'same-origin'}); return JSON.stringify({status:r.status, hash:location.hash, cookie:document.cookie}) })()`,
  awaitPromise: true,
  returnByValue: true
})
console.log('eval:', JSON.stringify(ev.result?.result?.value || ev.result))
ws.close()
