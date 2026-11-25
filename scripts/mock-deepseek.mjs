// 假的 DeepSeek 上游，用来在本地跑通流式链路（不需要真 Key）
// 启动：node scripts/mock-deepseek.mjs   （监听 127.0.0.1:8790）
import http from 'node:http'

const PORT = 8790

const ANSWER = `## 你此刻的状态
你现在的状态更像是在赶路途中突然停下，发现鞋里进了沙子。不是走不动，是每一步都硌得慌。这种疲惫通常不是懒，而是一段时间里你一直在硬撑。

## 牌面在说什么
战车逆位时，车厢里的两匹马朝不同方向使劲。牌面不是说你能力不够，而是说此刻的力气被分散了：想做的事太多，或者想照顾的人太多，于是每一件都只推进了一点点。

## 值得想一想
如果只能留下现在手上的一件事，你会留哪一件？剩下的那些，是真的必须现在做，还是你怕不做就会被认为不努力？

## 可以试试
今晚给自己留出二十分钟，不做任何"有用"的事。走一段没有目的地的路，或者只是把手机扣在桌上坐一会儿。让两匹马先停下来，方向才有机会重新对齐。`

const DISCLAIMER = '本内容由 AI 生成，仅供娱乐与自我觉察参考，不构成任何诊断或建议。'

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
  })

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end('not found')
    return
  }

  const body = await readBody(req)
  const note = body?.messages?.find((m) => m.role === 'user')?.content || ''

  if (note.includes('MOCK500')) {
    res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"boom"}')
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  })

  const text = note.includes('MOCKNODISCLAIMER') ? ANSWER : `${ANSWER}\n\n${DISCLAIMER}`
  const pieces = text.match(/[\s\S]{1,24}/g) || []

  for (const piece of pieces) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
    await new Promise((r) => setTimeout(r, 12))
  }
  res.write('data: [DONE]\n\n')
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock deepseek on http://127.0.0.1:${PORT}`)
})
