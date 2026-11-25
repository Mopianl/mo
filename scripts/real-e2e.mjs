// 真接口联调：登录 → 抽牌解读 → 统计首字时间 / 用量 / 花费
const BASE = process.env.BASE || 'http://127.0.0.1:8788'
const PASSWORD = process.env.ACCESS_PASSWORD || 'xiaofeiyv'

const gate = await fetch(`${BASE}/api/gate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD })
})
console.log('gate', gate.status, await gate.text())
const cookie = (gate.headers.get('set-cookie') || '').split(';')[0]
if (!cookie) throw new Error('没有拿到 cookie')

const cardId = process.argv[2] ?? 'major-16'
const orientation = process.argv[3] ?? 'upright'
const userNote = process.argv[4] ?? '最近总觉得自己反应慢，怕做不好'

const t0 = Date.now()
const res = await fetch(`${BASE}/api/reading`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie, accept: 'text/event-stream' },
  body: JSON.stringify({ cardId, orientation, userNote })
})
console.log('reading', res.status, res.headers.get('content-type'))

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buf = ''
let firstTokenMs = null
let text = ''
let done = null
let tokens = 0

if (!res.ok) {
  const raw = await res.text()
  console.log('error body:', raw)
  process.exit(1)
}

while (true) {
  const { value, done: end } = await reader.read()
  if (end) break
  buf += decoder.decode(value, { stream: true })
  const lines = buf.split('\n')
  buf = lines.pop()
  for (const line of lines) {
    const s = line.trim()
    if (!s.startsWith('data:')) continue
    const payload = s.slice(5).trim()
    if (payload === '[DONE]') continue
    let evt
    try { evt = JSON.parse(payload) } catch { continue }
    if (evt.delta) {
      if (firstTokenMs === null) firstTokenMs = Date.now() - t0
      text += evt.delta
      tokens += 1
    } else if (evt.done) {
      done = evt
    }
  }
}

console.log('--- 结果 ---')
console.log('首字耗时', firstTokenMs, 'ms')
console.log('总耗时', Date.now() - t0, 'ms')
console.log('delta 事件数', tokens, '正文字数', text.length)
console.log('done 事件', JSON.stringify(done))
console.log('--- 正文 ---')
console.log(text)
