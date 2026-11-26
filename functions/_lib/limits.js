// 三道闸门：每日全站上限、单 IP 限频、余额熔断。
// 依赖绑定 RATE_KV（Cloudflare KV）。没绑定时不拦，只记日志——
// 这样本地或忘记绑定也不会把站弄挂，但线上应当绑定。

const DAY_LIMIT_DEFAULT = 300
const IP_LIMIT_DEFAULT = 5
const BALANCE_MIN_DEFAULT = 3 // 元
const BALANCE_TTL_MS = 10 * 60 * 1000 // 余额最多 10 分钟查一次

const encoder = new TextEncoder()

/** 北京时间的一天，用来做"每日"的边界 */
function dayKey(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function hourKey(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 13)
}

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

const num = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 余额熔断：低于阈值就让整站暂停解读（危机词不受影响，仍然走关怀文案）。
 * 查到的结果在 KV 里缓存 10 分钟，避免每次请求都打 DeepSeek。
 */
async function balanceGuard(env, apiKey) {
  const kv = env.RATE_KV
  const min = num(env.BALANCE_MIN, BALANCE_MIN_DEFAULT)
  if (!kv) return { blocked: false }

  let state = null
  try {
    state = await kv.get('balance:state', 'json')
  } catch {}

  const stale = !state || Date.now() - (state.checkedAt || 0) > BALANCE_TTL_MS
  if (stale) {
    try {
      const res = await fetch('https://api.deepseek.com/user/balance', {
        headers: { authorization: `Bearer ${apiKey}` }
      })
      if (res.ok) {
        const data = await res.json()
        const info = (data.balance_infos || []).find((b) => b.currency === 'CNY') || data.balance_infos?.[0]
        const total = Number(info?.total_balance ?? NaN)
        state = {
          checkedAt: Date.now(),
          available: data.is_available !== false,
          total: Number.isFinite(total) ? total : null
        }
        await kv.put('balance:state', JSON.stringify(state), { expirationTtl: 1800 })
      }
    } catch {
      // 查不到就沿用上次结果；从没查成功过则放行
    }
  }

  if (!state) return { blocked: false }
  if (state.available === false) return { blocked: true, reason: 'BALANCE_EMPTY', total: state.total }
  if (typeof state.total === 'number' && state.total < min) {
    return { blocked: true, reason: 'BALANCE_LOW', total: state.total }
  }
  return { blocked: false, total: state.total }
}

/**
 * 用量闸门：先看余额，再数当天与这个 IP 的次数。
 * 返回 null 表示放行；否则返回 { code, message, status }。
 */
export async function checkQuota(request, env, apiKey) {
  const kv = env.RATE_KV
  if (!kv) {
    console.warn('[limits] RATE_KV 未绑定，限流与余额熔断已跳过')
    return null
  }

  const balance = await balanceGuard(env, apiKey)
  if (balance.blocked) {
    return {
      code: balance.reason,
      status: 503,
      message:
        balance.reason === 'BALANCE_EMPTY'
          ? '今天的解读额度用完了，服务明天再开。'
          : '服务暂时休息中，晚一点再来试试。'
    }
  }

  const dayLimit = num(env.DAY_LIMIT, DAY_LIMIT_DEFAULT)
  const ipLimit = num(env.IP_LIMIT, IP_LIMIT_DEFAULT)
  const today = dayKey()
  const hour = hourKey()

  const dayCounterKey = `day:${today}`
  const ipCounterKey = `ip:${clientIp(request)}:${hour}`

  const [dayCount, ipCount] = await Promise.all([
    kv.get(dayCounterKey).then((v) => Number(v || 0)),
    kv.get(ipCounterKey).then((v) => Number(v || 0))
  ])

  if (dayCount >= dayLimit) {
    return {
      code: 'DAILY_LIMIT',
      status: 429,
      message: '今日解读名额已满，明日再来。'
    }
  }
  if (ipCount >= ipLimit) {
    return {
      code: 'IP_LIMIT',
      status: 429,
      message: '今天先聊到这儿吧，歇一会儿再来。'
    }
  }

  // 先记账再放行：宁可多记一次，也不让并发把额度冲穿
  await Promise.all([
    kv.put(dayCounterKey, String(dayCount + 1), { expirationTtl: 172800 }),
    kv.put(ipCounterKey, String(ipCount + 1), { expirationTtl: 7200 })
  ])

  return null
}
