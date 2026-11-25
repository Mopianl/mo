// 通用：给定 file:// 或 http:// 地址，按 390×844@2x 截图
import fs from 'node:fs'
import path from 'node:path'

const [url, out, waitMs = '4000', dpr = '2'] = process.argv.slice(2)
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
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: Number(dpr), mobile: true
})
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, Number(waitMs)))
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log('saved', path.basename(out), fs.statSync(out).size, 'bytes')
ws.close()
