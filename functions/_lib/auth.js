// 口令与 cookie 共用的签名/校验工具（Cloudflare Pages Functions）

export const COOKIE_NAME = 'tarot_pass'
const TTL_SECONDS = 30 * 24 * 60 * 60 // 30 天

const enc = new TextEncoder()

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  })
}

function toB64Url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 定长比较，避免时序侧信道 */
export function safeEqual(a, b) {
  const x = enc.encode(String(a))
  const y = enc.encode(String(b))
  let diff = x.length ^ y.length
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) diff |= (x[i % x.length] || 0) ^ (y[i % y.length] || 0)
  return diff === 0
}

export async function issueToken(secret) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const sig = await hmacHex(secret, `v1.${exp}`)
  return `${exp}.${sig}`
}

export async function verifyToken(secret, token) {
  if (typeof token !== 'string') return false
  const [expRaw, sig] = token.split('.')
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
  const expected = await hmacHex(secret, `v1.${exp}`)
  return safeEqual(sig || '', expected)
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function sessionCookie(value, url, maxAge = TTL_SECONDS) {
  const secure = new URL(url).protocol === 'https:' ? '; Secure' : ''
  const age = value ? maxAge : 0
  return `${COOKIE_NAME}=${value || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`
}

/** 口令本身（只用于比对，绝不参与签名） */
export function passwordOf(env) {
  const p = env.ACCESS_PASSWORD
  return typeof p === 'string' && p.length >= 4 ? p : null
}

/** 签名密钥：优先 TAROT_SECRET，退化到口令。未配置返回 null */
export function secretOf(env) {
  const s = env.TAROT_SECRET || env.ACCESS_PASSWORD
  return typeof s === 'string' && s.length >= 4 ? s : null
}

/** 校验请求是否已带有效口令 cookie */
export async function isUnlocked(request, env) {
  const secret = secretOf(env)
  if (!secret) return false
  return verifyToken(secret, readCookie(request, COOKIE_NAME))
}

export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local'
  )
}
