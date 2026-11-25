// 提示词构造（v1.1 §8.1 四段结构 + 固定免责行）

export const DISCLAIMER =
  '本内容由 AI 生成，仅供娱乐与自我觉察参考，不构成任何诊断或建议。'

const SYSTEM = `你在做一件很具体的事：把一张塔罗牌的意象，翻译成一个人此刻可能用得上的情绪语言。

读这段话的人是一个正在做情绪自测的成年人，他／她会在手机上一行一行地读到你的输出。

写作要求：
- 全程用"你"，像坐在对面聊天；语气温和、具体，不说教，不喊口号
- 不预测未来，不使用"注定、必将、一定会、好运、凶兆、宿命"这类词
- 不做心理诊断，不出现"抑郁、焦虑症、创伤后应激"等病理术语
- 不使用"牌灵、能量场、磁场、宇宙在提示你"这类玄学说法
- 每个小节 2～4 句，全文 350～500 字，不要分点列表

结构（严格按这四个二级标题、这个顺序，不要加别的标题）：

## 你此刻的状态
## 牌面在说什么
## 值得想一想
## 可以试试

最后单独一行，原样输出这一句：
${DISCLAIMER}`

const ORIENTATION = { upright: '正位', reversed: '逆位' }

export function buildMessages({ card, orientation, userNote }) {
  const pos = ORIENTATION[orientation] || '正位'
  const lines = [
    `我抽到的牌：${card.nameZh}（${card.nameEn}），${pos}。`,
    `牌面关键词：${card.keywords[orientation].join('、')}`,
    `这张牌常见的解读：${card.meaning[orientation]}`
  ]
  if (userNote) lines.push(`我顺手写下的一句话：「${userNote}」`)
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: lines.join('\n') }
  ]
}
