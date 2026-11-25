import cards from '../../data/cards.json'
import { isUnlocked, json } from '../_lib/auth.js'
import { isCrisis, CRISIS_REPLY } from '../_lib/crisis.js'
import { buildMessages, DISCLAIMER } from '../_lib/prompt.js'

const FIRST_TOKEN_MS = 15000 // 首字 15 秒没来就降级
const TOTAL_MS = 60000 // 整段最多 60 秒
const MODEL_FALLBACK = 'deepseek-chat' // 文档里的 deepseek-flash 不是官方模型名

const encoder = new TextEncoder()
const sse = (obj) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)

function streamHeaders() {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no'
  }
}

/** 一段只含固定文字的流（危机拦截用，全程不碰模型） */
function textStream(text, safety) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse({ delta: text }))
      controller.enqueue(sse({ done: true, degraded: false, safety }))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })
  return new Response(stream, { headers: streamHeaders() })
}

export async function onRequestPost({ request, env }) {
  if (!(await isUnlocked(request, env))) return json({ error: 'UNAUTHORIZED' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'INVALID_INPUT' }, 400)
  }

  const orientation = body?.orientation
  if (orientation !== 'upright' && orientation !== 'reversed') {
    return json({ error: 'INVALID_INPUT' }, 400)
  }
  const card = cards.find((c) => c.id === body?.cardId)
  if (!card) return json({ error: 'INVALID_INPUT' }, 400)
  const userNote = typeof body?.userNote === 'string' ? body.userNote.trim().slice(0, 120) : ''

  // 危机词：不调模型，直接关怀文案
  if (isCrisis(userNote)) {
    return textStream(CRISIS_REPLY, { level: 'crisis' })
  }

  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) return json({ error: 'UPSTREAM_ERROR', detail: 'DEEPSEEK_API_KEY missing' }, 503)

  const endpoint = env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions'
  const model = env.DEEPSEEK_MODEL || MODEL_FALLBACK

  const controller = new AbortController()
  const firstTimer = setTimeout(() => controller.abort(new Error('FIRST_TOKEN_TIMEOUT')), FIRST_TOKEN_MS)
  const totalTimer = setTimeout(() => controller.abort(new Error('TOTAL_TIMEOUT')), TOTAL_MS)

  let upstream
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        accept: 'text/event-stream'
      },
      body: JSON.stringify({
        model,
        messages: buildMessages({ card, orientation, userNote }),
        temperature: 0.8,
        max_tokens: 1200,
        stream: true
      }),
      signal: controller.signal
    })
  } catch {
    clearTimeout(firstTimer)
    clearTimeout(totalTimer)
    return json({ error: 'UPSTREAM_ERROR' }, 502)
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(firstTimer)
    clearTimeout(totalTimer)
    return json({ error: 'UPSTREAM_ERROR', status: upstream.status }, 502)
  }

  const stream = new ReadableStream({
    async start(streamController) {
      const send = (obj) => streamController.enqueue(sse(obj))
      let acc = ''
      let firstSeen = false

      try {
        const reader = upstream.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const raw of lines) {
            const line = raw.trim()
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue

            let chunk
            try {
              chunk = JSON.parse(payload)
            } catch {
              continue
            }
            const delta = chunk?.choices?.[0]?.delta?.content
            if (!delta) continue

            if (!firstSeen) {
              firstSeen = true
              clearTimeout(firstTimer)
            }
            acc += delta
            send({ delta })
          }
        }

        if (!acc.trim()) {
          send({ error: 'UPSTREAM_TIMEOUT' })
        } else {
          if (!acc.includes('仅供娱乐与自我觉察参考')) {
            send({ delta: `\n\n${DISCLAIMER}` })
          }
          send({ done: true, degraded: false, safety: { level: 'none' } })
        }
      } catch {
        send({ error: firstSeen ? 'UPSTREAM_ERROR' : 'UPSTREAM_TIMEOUT' })
      } finally {
        clearTimeout(firstTimer)
        clearTimeout(totalTimer)
        try {
          streamController.enqueue(encoder.encode('data: [DONE]\n\n'))
          streamController.close()
        } catch {}
      }
    },
    cancel() {
      clearTimeout(firstTimer)
      clearTimeout(totalTimer)
      controller.abort()
    }
  })

  return new Response(stream, { headers: streamHeaders() })
}
