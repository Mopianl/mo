// 打印一次真实解读的开头，用来核对格式：node scripts/peek-reading.mjs
const base = process.env.BASE || 'http://127.0.0.1:8788'

const gate = await fetch(`${base}/api/gate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.ACCESS_PASSWORD || 'xiaofeiyv' })
})
const cookie = (gate.headers.get('set-cookie') || '').split(';')[0]
console.log('gate', gate.status, cookie.slice(0, 24) + '…')

const res = await fetch(`${base}/api/reading`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ cardId: 'major-13', orientation: 'upright', userNote: '今天有点累' })
})
console.log('reading', res.status, res.headers.get('content-type'))

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buf = ''
let text = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += decoder.decode(value, { stream: true })
  const lines = buf.split('\n')
  buf = lines.pop()
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') continue
    try {
      const evt = JSON.parse(payload)
      if (evt.delta) text += evt.delta
      if (evt.done) console.log('done', JSON.stringify({ degraded: evt.degraded, safety: evt.safety }))
      if (evt.error) console.log('error', evt.error)
    } catch {}
  }
}
console.log('length', text.length)
console.log('has4', text.includes('## 你此刻的状态'), text.includes('## 可以试试'))
console.log('hasDisclaimer', text.includes('仅供娱乐与自我觉察参考'))
process.stdout.write('--- 前 400 字 ---\n' + text.slice(0, 400) + '\n--- 末 200 字 ---\n' + text.slice(-200) + '\n')
