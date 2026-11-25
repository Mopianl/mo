import {
  clientIp,
  issueToken,
  isUnlocked,
  json,
  passwordOf,
  safeEqual,
  secretOf,
  sessionCookie
} from '../_lib/auth.js'

// 单实例内存限流：10 分钟内同一 IP 最多 5 次试错。
// Pages Functions 是无状态的，多实例下只能算「尽力而为」，挡脚本够用。
const FAIL_WINDOW = 10 * 60 * 1000
const MAX_FAILS = 5
const attempts = new Map()

function checkRate(ip) {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > FAIL_WINDOW) {
    attempts.set(ip, { count: 0, first: now })
    return 0
  }
  return rec.count >= MAX_FAILS ? Math.ceil((rec.first + FAIL_WINDOW - now) / 1000) : 0
}

function noteFail(ip) {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || now - rec.first > FAIL_WINDOW) attempts.set(ip, { count: 1, first: now })
  else rec.count += 1
  if (attempts.size > 2000) attempts.clear() // 防止内存无限增长
}

// 已解锁 → 200；未解锁 → 401
export async function onRequestGet({ request, env }) {
  if (!secretOf(env)) return json({ ok: false, error: 'CONFIG_MISSING' }, 500)
  const unlocked = await isUnlocked(request, env)
  return json({ ok: unlocked }, unlocked ? 200 : 401)
}

export async function onRequestPost({ request, env }) {
  const password0 = passwordOf(env)
  if (!password0) return json({ ok: false, error: 'CONFIG_MISSING' }, 500)

  const ip = clientIp(request)
  const wait = checkRate(ip)
  if (wait) return json({ ok: false, error: 'RATE_LIMITED', retryAfter: wait }, 429)

  let password = ''
  try {
    const body = await request.json()
    password = typeof body?.password === 'string' ? body.password.trim() : ''
  } catch {
    return json({ ok: false, error: 'INVALID_INPUT' }, 400)
  }
  if (!password || password.length > 64) {
    return json({ ok: false, error: 'INVALID_INPUT' }, 400)
  }

  if (!safeEqual(password, password0)) {
    noteFail(ip)
    return json({ ok: false, error: 'WRONG_PASSWORD' }, 401)
  }

  attempts.delete(ip)
  const token = await issueToken(secretOf(env) || password0)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, request.url) })
}

// 退出登录
export async function onRequestDelete({ request }) {
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', request.url) })
}
