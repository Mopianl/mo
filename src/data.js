import cards from '../data/cards.json'

export const CARDS = cards
export const ORIENTATIONS = ['upright', 'reversed']

export function cardById(id) {
  return CARDS.find((c) => c.id === id) || null
}

/** 随机抽一张，50/50 正逆位 */
export function drawCard() {
  const card = CARDS[Math.floor(Math.random() * CARDS.length)]
  const orientation = Math.random() < 0.5 ? 'upright' : 'reversed'
  return { card, orientation }
}

export function cardImage(id) {
  return `./cards/${id}.webp`
}

/* ---------- 设置（唯一允许落盘的本地数据） ---------- */
const KEY = 'tarot.settings.v1'
const DEFAULTS = {
  schemaVersion: 1,
  ageConfirmed: false,
  reduceMotion: false,
  createdAt: null
}

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { ...DEFAULTS, ...raw }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch }
  if (!next.createdAt) next.createdAt = new Date().toISOString()
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  return next
}
