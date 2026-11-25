// 对本地 wrangler pages dev 做端到端检查：node scripts/e2e.mjs
const base = process.env.BASE || 'http://127.0.0.1:8788'
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
check('流里有四段小标题', body.includes('## 你此刻的状态') && body.includes('## 可以试试'))
check('流里有结束标记', body.includes('"done":true'))
check('流里有免责行', body.includes('仅供娱乐与自我觉察参考'))

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
check('危机词不调模型（无四段小标题）', !body.includes('## 你此刻的状态'))

// 非法入参
res = await reading({ cardId: 'major-99', orientation: 'upright' })
check('未知牌 400', res.status === 400, res.status)
res = await reading({ cardId: 'major-13', orientation: 'sideways' })
check('非法朝向 400', res.status === 400, res.status)

// 上游 500 → 502，前端走降级
res = await reading({ cardId: 'major-13', orientation: 'upright', userNote: 'MOCK500' })
check('上游报错 502', res.status === 502, res.status)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
