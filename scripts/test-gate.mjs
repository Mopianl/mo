// 本地跑一遍口令逻辑，不依赖 wrangler：node scripts/test-gate.mjs
import { onRequestGet as getGate, onRequestPost as postGate } from '../functions/api/gate.js'
import { onRequestPost as postReading } from '../functions/api/reading.js'

const env = { ACCESS_PASSWORD: 'xiaofeiyv', TAROT_SECRET: 'test-secret-0123456789abcdef' }
const base = 'https://tarot.test/api/gate'
let pass = 0
let fail = 0

function check(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    fail++
    console.log(`  FAIL ${name} ${extra}`)
  }
}

function req(url, init) {
  return new Request(url, init)
}

const ctx = (request) => ({ request, env })

// 1. 未登录 GET → 401
let res = await getGate(ctx(req(base)))
check('GET 未登录返回 401', res.status === 401, `got ${res.status}`)

// 2. 错误口令 → 401
res = await postGate(
  ctx(req(base, { method: 'POST', body: JSON.stringify({ password: 'nope' }) }))
)
check('错误口令返回 401', res.status === 401, `got ${res.status}`)
check('错误口令 body', (await res.clone().json()).error === 'WRONG_PASSWORD')

// 3. 正确口令 → 200 + cookie
res = await postGate(
  ctx(req(base, { method: 'POST', body: JSON.stringify({ password: 'xiaofeiyv' }) }))
)
check('正确口令返回 200', res.status === 200, `got ${res.status}`)
const setCookie = res.headers.get('set-cookie') || ''
check('种下 tarot_pass cookie', setCookie.includes('tarot_pass='), setCookie)
check('cookie 是 HttpOnly', /HttpOnly/i.test(setCookie))
const cookie = setCookie.split(';')[0]

// 4. 带 cookie GET → 200
res = await getGate(ctx(req(base, { headers: { cookie } })))
check('带 cookie 返回 200', res.status === 200, `got ${res.status}`)

// 5. 被篡改的 cookie → 401
res = await getGate(ctx(req(base, { headers: { cookie: cookie.slice(0, -2) + 'ff' } })))
check('篡改 cookie 返回 401', res.status === 401, `got ${res.status}`)

// 6. 过期的 cookie → 401
const expired = `tarot_pass=1000000000.deadbeef`
res = await getGate(ctx(req(base, { headers: { cookie: expired } })))
check('过期 cookie 返回 401', res.status === 401, `got ${res.status}`)

// 7. /api/reading 未带 cookie → 401
res = await postReading(
  ctx(req('https://tarot.test/api/reading', { method: 'POST', body: '{}' }))
)
check('reading 未登录返回 401', res.status === 401, `got ${res.status}`)

// 8. /api/reading 带 cookie → 501（T2 未接）
res = await postReading(
  ctx(req('https://tarot.test/api/reading', { method: 'POST', body: '{}', headers: { cookie } }))
)
check('reading 已登录返回 501', res.status === 501, `got ${res.status}`)

// 9. 连续试错触发限流
for (let i = 0; i < 6; i++) {
  res = await postGate(
    ctx(req(base, { method: 'POST', body: JSON.stringify({ password: 'bad' }) }))
  )
}
check('连续试错触发 429', res.status === 429, `got ${res.status}`)

// 10. 没配环境变量 → 500
res = await getGate({ request: req(base), env: {} })
check('未配置口令返回 500', res.status === 500, `got ${res.status}`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
