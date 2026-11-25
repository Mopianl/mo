// 点击「查看解读」后的降级状态截图
import fs from 'node:fs'
import crypto from 'node:crypto'

const devVars = fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
const env = Object.fromEntries(
  devVars.split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
)
const targets = await (await fetch('http://127.0.0.1:' + (process.env.CDP_PORT || 9222) + '/json/list')).json()
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
await send('Page.navigate', { url: 'http://127.0.0.1:8788/#/reading' })
await new Promise((r) => setTimeout(r, 1500))
await send('Page.reload')
await new Promise((r) => setTimeout(r, 2200))
const click = await send('Runtime.evaluate', {
  expression: `(() => { const b = document.querySelector('button.primary'); if (!b) return 'no button'; b.click(); return 'clicked' })()`,
  returnByValue: true
})
console.log(click.result?.result?.value)
await new Promise((r) => setTimeout(r, 2500))
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(process.argv[2], Buffer.from(shot.result.data, 'base64'))
console.log('saved', fs.statSync(process.argv[2]).size, 'bytes')
ws.close()
