// 危机词拦截：命中就完全不调模型，直接给关怀文案与求助渠道。

export const CRISIS_WORDS = [
  '自杀',
  '自残',
  '不想活',
  '活着没意思',
  '想死',
  '结束生命',
  '割腕',
  '跳楼',
  '伤害自己',
  '撑不下去'
]

/** 除了关键词，也挡住"想死"被拆开写的常见变体（想 死 / 想…死） */
const LOOSE = [/想\s*死/, /不想\s*活/, /活\s*着\s*没\s*意思/]

export function isCrisis(text) {
  if (typeof text !== 'string' || !text) return false
  const t = text.replace(/\s+/g, '')
  if (CRISIS_WORDS.some((w) => t.includes(w))) return true
  return LOOSE.some((re) => re.test(text))
}

export const CRISIS_REPLY = `我听到你说的这些了。

在往下走之前，想先认真说一句：你现在的感受很重，这不是"想太多"，它值得被好好对待。

如果你此刻有伤害自己的念头，请先联系能立刻回应你的人：
· 全国心理援助热线 12356（24 小时）
· 急救 120 ／ 报警 110

也可以现在就告诉身边一个信得过的人，哪怕只说一句"我现在不太好"。

这张牌先放在这里，不急着解释它。你不需要一个人扛着。`
