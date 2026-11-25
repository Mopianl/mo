// 对本地 wrangler pages dev 做端到端检查：node scripts/e2e.mjs
import fs from 'node:fs'

const base = process.env.BASE || 'http://127.0.0.1:8788'
// 本地 .dev.vars 指向 mock 上游时，输出是固定的，可以做严格断言；
// 指向真 DeepSeek 时，内容有波动，只断言"能流出来、能收尾"。
const devVars = fs.existsSync(new URL('../.dev.vars', import.meta.url))
  ? fs.readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  : ''
const mockMode = /DEEPSEEK_MODEL\s*=\s*mock-model/.test(devVars)
let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    fail++
    console.log(`  FAIL ${name} ${extra}`)
  }
}

// 首页
let res = await fetch(base + '/')
const html = await res.text()
check('GET / 200', res.status === 200, res.status)
check('首页含挂载点', html.includes('id="app"'))

// 牌面
res = await fetch(base + '/cards/major-13.webp')
const buf = await res.arrayBuffer()
check('GET 牌面 200', res.status === 200, res.status)
check('牌面 ≤100KB', buf.byteLength <= 100 * 1024, `${buf.byteLength} bytes`)

// 未登录 gate
res = await fetch(base + '/api/gate')
check('未登录 /api/gate 401', res.status === 401, res.status)

// 错误口令
res = await fetch(base + '/api/gate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'wrong-pass' })
})
check('错误口令 401', res.status === 401, res.status)

// 正确口令
res = await fetch(base + '/api/gate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'xiaofeiyv' })
})
const setCookie = res.headers.get('set-cookie') || ''
check('正确口令 200', res.status === 200, res.status)
check('返回 Set-Cookie', setCookie.includes('tarot_pass='), setCookie.slice(0, 40))
const cookie = setCookie.split(';')[0]

// 带 cookie 再查
res = await fetch(base + '/api/gate', { headers: { cookie } })
check('带 cookie /api/gate 200', res.status === 200, res.status)

// 未登录 reading
res = await fetch(base + '/api/reading', { method: 'POST', body: '{}' })
check('未登录 /api/reading 401', res.status === 401, res.status)

// 登录后 reading（本地 .dev.vars 指向 scripts/mock-deepseek.mjs）
const readAll = async (r) => {
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let out = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += dec.decode(value, { stream: true })
  }
  return out
}

/** 把 SSE 里的 delta 拼回全文（模型是逐 token 吐的，直接搜原始报文会搜不到） */
const textOf = (raw) =>
  raw
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6).trim())
    .filter((l) => l && l !== '[DONE]')
    .map((l) => {
      try {
        return JSON.parse(l).delta || ''
      } catch {
        return ''
      }
    })
    .join('')

const reading = (payload) =>
  fetch(base + '/api/reading', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })

res = await reading({ cardId: 'major-13', orientation: 'upright', userNote: '有点累' })
check('已登录 /api/reading 200', res.status === 200, res.status)
check('返回 event-stream', (res.headers.get('content-type') || '').includes('text/event-stream'))
let body = await readAll(res)
const text = textOf(body)
const degraded = body.includes('"degraded":true')
if (mockMode) {
  check('流里有四段小标题', text.includes('## 你此刻的状态') && text.includes('## 可以试试'))
  check('流里有免责行', text.includes('仅供娱乐与自我觉察参考'))
} else {
  // 真模型：要么四段齐全，要么明确降级并给出牌义兜底
  check('真模型：四段齐全或降级兜底', (text.includes('## 你此刻的状态') && text.includes('## 可以试试')) || degraded)
  check('真模型：免责行仍在', text.includes('仅供娱乐与自我觉察参考'))
}
check('流里有结束标记', body.includes('"done":true'))

// 逆位
res = await reading({ cardId: 'major-13', orientation: 'reversed' })
body = await readAll(res)
check('逆位也能出文', res.status === 200 && body.includes('"delta"'))

// 危机词：不调模型，直接关怀文案
res = await reading({ cardId: 'major-13', orientation: 'upright', userNote: '我真的想死' })
body = await readAll(res)
check('危机词 200', res.status === 200, res.status)
check('危机词包含 12356', body.includes('12356'))
check('危机词打 crisis 标记', body.includes('"level":"crisis"'))
check('危机词不调模型（无四段小标题）', !textOf(body).includes('## 你此刻的状态'))

// 非法入参
res = await reading({ cardId: 'major-99', orientation: 'upright' })
check('未知牌 400', res.status === 400, res.status)
res = await reading({ cardId: 'major-13', orientation: 'sideways' })
check('非法朝向 400', res.status === 400, res.status)

// 上游 500 → 502，前端走降级（只有 mock 上游能稳定复现）
if (mockMode) {
  res = await reading({ cardId: 'major-13', orientation: 'upright', userNote: 'MOCK500' })
  check('上游报错 502', res.status === 502, res.status)
} else {
  console.log('  skip  上游强制 500（当前指向真模型）')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
