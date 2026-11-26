// 闸门单元测试：用内存版 KV 与假余额接口跑 limits.js
// node scripts/test-limits.mjs
import { checkQuota } from '../functions/_lib/limits.js'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log('  ok  ', name)
  } else {
    fail++
    console.log('  FAIL', name, extra)
  }
}

/** 最小 KV 实现，够 limits.js 用 */
function fakeKv() {
  const store = new Map()
  return {
    async get(key, type) {
      const raw = store.get(key)
      if (raw == null) return null
      return type === 'json' ? JSON.parse(raw) : raw
    },
    async put(key, value) {
      store.set(key, value)
    },
    _store: store
  }
}

const req = (ip) => new Request('https://example.com/api/reading', {
  method: 'POST',
  headers: { 'cf-connecting-ip': ip }
})

// 余额接口：可切换返回
let balancePayload = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '20.00' }] }
let balanceCalls = 0
globalThis.fetch = async () => {
  balanceCalls++
  return new Response(JSON.stringify(balancePayload), { status: 200 })
}

// 1. 没绑 KV：放行（fail-open）
check('未绑 KV 时放行', (await checkQuota(req('1.1.1.1'), {}, 'k')) === null)

// 2. 单 IP 每小时 5 次
{
  const env = { RATE_KV: fakeKv(), IP_LIMIT: '5', DAY_LIMIT: '300' }
  const codes = []
  for (let i = 0; i < 6; i++) {
    const r = await checkQuota(req('2.2.2.2'), env, 'k')
    codes.push(r ? r.code : 'OK')
  }
  check('前 5 次放行', codes.slice(0, 5).every((c) => c === 'OK'), codes.join(','))
  check('第 6 次 IP_LIMIT', codes[5] === 'IP_LIMIT', codes[5])

  // 3. 另一个 IP 不受影响
  check('换 IP 重新计数', (await checkQuota(req('3.3.3.3'), env, 'k')) === null)
}

// 4. 每日上限
{
  const env = { RATE_KV: fakeKv(), IP_LIMIT: '99', DAY_LIMIT: '2' }
  const first = await checkQuota(req('4.4.4.4'), env, 'k')
  const second = await checkQuota(req('5.5.5.5'), env, 'k')
  const third = await checkQuota(req('6.6.6.6'), env, 'k')
  check('每日 2 次内放行', first === null && second === null)
  check('超出每日上限', third?.code === 'DAILY_LIMIT', third?.code)
  check('提示文案含"明日"', (third?.message || '').includes('明日'), third?.message)
}

// 5. 余额低于阈值 → 停服，且提示不暴露具体金额
{
  balancePayload = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '1.20' }] }
  const env = { RATE_KV: fakeKv(), IP_LIMIT: '5', DAY_LIMIT: '300', BALANCE_MIN: '3' }
  const r = await checkQuota(req('7.7.7.7'), env, 'k')
  check('余额不足时拦下', r?.code === 'BALANCE_LOW', r?.code)
  check('余额提示不含金额', !/\d/.test(r?.message || ''), r?.message)
}

// 6. 余额查过就缓存，短时间内不再打接口
{
  balancePayload = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '50.00' }] }
  balanceCalls = 0
  const env = { RATE_KV: fakeKv(), IP_LIMIT: '99', DAY_LIMIT: '99', BALANCE_MIN: '3' }
  await checkQuota(req('8.8.8.8'), env, 'k')
  await checkQuota(req('9.9.9.9'), env, 'k')
  check('余额结果被缓存', balanceCalls === 1, balanceCalls)
}

// 7. 账户不可用（欠费）也停服
{
  balancePayload = { is_available: false, balance_infos: [{ currency: 'CNY', total_balance: '0.00' }] }
  const env = { RATE_KV: fakeKv(), IP_LIMIT: '5', DAY_LIMIT: '300' }
  const r = await checkQuota(req('10.10.10.10'), env, 'k')
  check('账户不可用时拦下', r?.code === 'BALANCE_EMPTY', r?.code)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
