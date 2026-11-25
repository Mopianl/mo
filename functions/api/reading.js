import { isUnlocked, json } from '../_lib/auth.js'

// T2 阶段接 DeepSeek 流式；现在先返回 501，让前端走降级文案。
export async function onRequestPost({ request, env }) {
  if (!(await isUnlocked(request, env))) return json({ error: 'UNAUTHORIZED' }, 401)
  return json({ error: 'NOT_IMPLEMENTED' }, 501)
}
