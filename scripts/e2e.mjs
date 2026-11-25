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

// 登录后 reading（T2 未接 → 501）
res = await fetch(base + '/api/reading', {
  method: 'POST',
  headers: { cookie },
  body: JSON.stringify({ cardId: 'major-13', orientation: 'upright' })
})
check('已登录 /api/reading 501', res.status === 501, res.status)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
