// 验证「再抽一张」真的换牌：读两次 h1 文本
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
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
await wait(1500)
await send('Page.reload')
await wait(2000)

await evaluate(`document.querySelector('button.primary')?.click()`)
await wait(500)
await evaluate(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('18'))?.click()`)
await wait(1600)
await evaluate(`document.querySelector('button.primary')?.click()`)
await wait(4000)

const first = await evaluate(`document.querySelector('h1')?.textContent`)
const btn = await evaluate(`[...document.querySelectorAll('button.ghost')].map(b => b.textContent.trim()).join('|')`)
await evaluate(`[...document.querySelectorAll('button.ghost')].find(x => x.textContent.includes('再抽一张'))?.click()`)
await wait(1800)
const second = await evaluate(`document.querySelector('h1')?.textContent`)
const hasPrimary = await evaluate(`!!document.querySelector('button.primary')`)

console.log('ghost buttons:', btn)
console.log('first card:', first)
console.log('after draw-again:', second)
console.log('reset to 查看解读:', hasPrimary)
console.log(second && second !== first ? 'PASS: 换了一张牌' : 'FAIL: 没换牌')
ws.close()
