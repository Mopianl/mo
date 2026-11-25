import { reactive } from 'vue'

export const auth = reactive({ checked: false, unlocked: false })

/** 服务端校验 cookie：已解锁返回 true */
export async function checkGate() {
  try {
    const res = await fetch('/api/gate', { credentials: 'same-origin' })
    auth.unlocked = res.ok
  } catch {
    auth.unlocked = false
  }
  auth.checked = true
  return auth.unlocked
}

/** 提交口令，成功则服务端种 cookie */
export async function submitPassword(password) {
  let res
  try {
    res = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'same-origin'
    })
  } catch {
    return { ok: false, code: 'NETWORK' }
  }
  const data = await res.json().catch(() => ({}))
  if (res.ok && data.ok) {
    auth.unlocked = true
    return { ok: true }
  }
  return { ok: false, code: data.error || 'ERROR', retryAfter: data.retryAfter }
}

/**
 * 流式解读。onDelta(text) 逐字回调；返回 { text, degraded, safety }
 * 未接入 API 时抛错，由调用方降级。
 */
export async function streamReading(payload, onDelta) {
  const res = await fetch('/api/reading', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin'
  })
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.error || 'UPSTREAM_ERROR')
    err.code = data.error || 'UPSTREAM_ERROR'
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let meta = { degraded: false, safety: { level: 'none' } }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop()
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') continue
      let evt
      try {
        evt = JSON.parse(raw)
      } catch {
        continue
      }
      if (evt.error) {
        const err = new Error(evt.error)
        err.code = evt.error
        err.partial = text
        throw err
      }
      if (evt.delta) {
        text += evt.delta
        onDelta && onDelta(evt.delta)
      }
      if (evt.done) meta = { degraded: !!evt.degraded, safety: evt.safety || meta.safety }
    }
  }
  return { text, ...meta }
}
