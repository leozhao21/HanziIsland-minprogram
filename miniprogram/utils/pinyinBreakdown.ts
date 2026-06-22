import { PinyinAgeMode } from '../domain/models'

export type PinyinPartKind = 'initial' | 'medial' | 'final'

export interface PinyinPart {
  kind: PinyinPartKind
  bare: string
  display: string
  /** j/q/x 后的 u 实际读 ü */
  usesUmlautU?: boolean
}

export interface PinyinBreakdown {
  full: string
  parts: PinyinPart[]
  tone: number
  toneLabel: string
  toneHint: string
  canBreakdown: boolean
  isWholeSyllable: boolean
  wholeSyllableNote: string
}

const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l',
  'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
]

const WHOLE_SYLLABLES = new Set([
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
])

const I_MEDIAL_FINALS = ['iao', 'ian', 'iang', 'ia', 'ie'] as const
const U_MEDIAL_FINALS = ['uang', 'uai', 'uan', 'ua', 'uo'] as const

const TONE_VOWELS: Record<string, { tone: number; base: string }> = {
  'ā': { tone: 1, base: 'a' }, 'á': { tone: 2, base: 'a' }, 'ǎ': { tone: 3, base: 'a' }, 'à': { tone: 4, base: 'a' },
  'ē': { tone: 1, base: 'e' }, 'é': { tone: 2, base: 'e' }, 'ě': { tone: 3, base: 'e' }, 'è': { tone: 4, base: 'e' },
  'ī': { tone: 1, base: 'i' }, 'í': { tone: 2, base: 'i' }, 'ǐ': { tone: 3, base: 'i' }, 'ì': { tone: 4, base: 'i' },
  'ō': { tone: 1, base: 'o' }, 'ó': { tone: 2, base: 'o' }, 'ǒ': { tone: 3, base: 'o' }, 'ò': { tone: 4, base: 'o' },
  'ū': { tone: 1, base: 'u' }, 'ú': { tone: 2, base: 'u' }, 'ǔ': { tone: 3, base: 'u' }, 'ù': { tone: 4, base: 'u' },
  'ǖ': { tone: 1, base: 'v' }, 'ǘ': { tone: 2, base: 'v' }, 'ǚ': { tone: 3, base: 'v' }, 'ǜ': { tone: 4, base: 'v' },
  'ü': { tone: 0, base: 'v' },
}

const TONE_LABELS: Record<number, string> = {
  1: '第一声',
  2: '第二声',
  3: '第三声',
  4: '第四声',
  5: '轻声',
}

const TONE_HINTS: Record<number, string> = {
  1: '第一声又高又平，像唱歌拉长音。',
  2: '第二声像提问，尾巴往上扬。',
  3: '第三声先往下再往上，像小声答应「嗯？」',
  4: '第四声短而有力，像下命令。',
  5: '轻声读得又轻又短，常常放在词后面。',
}

function normalizeBare(input: string): string {
  let bare = ''
  for (const ch of input.trim()) {
    const mapped = TONE_VOWELS[ch]
    bare += mapped ? mapped.base : ch.toLowerCase()
  }
  return bare.replace(/ü/g, 'v')
}

function detectTone(input: string): number {
  for (const ch of input.trim()) {
    const mapped = TONE_VOWELS[ch]
    if (mapped && mapped.tone > 0) return mapped.tone
  }
  return 5
}

function splitInitial(bare: string): { initial: string; rhyme: string } {
  for (const ini of INITIALS) {
    if (bare.startsWith(ini)) {
      const rhyme = bare.slice(ini.length)
      if (rhyme.length > 0) return { initial: ini, rhyme }
    }
  }
  return { initial: '', rhyme: bare }
}

function trySplitIMedial(rhyme: string): { medial: string; final: string } | null {
  if (!rhyme.startsWith('i') || rhyme.length < 2) return null
  for (let i = 0; i < I_MEDIAL_FINALS.length; i++) {
    const pattern = I_MEDIAL_FINALS[i]
    if (rhyme.startsWith(pattern)) {
      return { medial: 'i', final: rhyme.slice(1) }
    }
  }
  return null
}

function trySplitUMedial(rhyme: string): { medial: string; final: string } | null {
  if (!rhyme.startsWith('u') || rhyme.length < 2) return null
  for (let i = 0; i < U_MEDIAL_FINALS.length; i++) {
    const pattern = U_MEDIAL_FINALS[i]
    if (rhyme.startsWith(pattern)) {
      return { medial: 'u', final: rhyme.slice(1) }
    }
  }
  if (rhyme === 'ui') return { medial: 'u', final: 'i' }
  return null
}

function splitRhyme(rhyme: string, initial: string): { medial: string; final: string } {
  if (!rhyme) return { medial: '', final: '' }

  const jqx = initial === 'j' || initial === 'q' || initial === 'x'

  if (jqx) {
    const iSplit = trySplitIMedial(rhyme)
    if (iSplit) return iSplit
    return { medial: '', final: rhyme }
  }

  const uSplit = trySplitUMedial(rhyme)
  if (uSplit) return uSplit

  const iSplit = trySplitIMedial(rhyme)
  if (iSplit) return iSplit

  return { medial: '', final: rhyme }
}

function isJqx(initial: string): boolean {
  return initial === 'j' || initial === 'q' || initial === 'x'
}

const U_TO_UMLAUT_DISPLAY: Record<string, string> = {
  u: 'ü',
  ū: 'ǖ',
  ú: 'ǘ',
  ǔ: 'ǚ',
  ù: 'ǜ',
}

function toUmlautDisplay(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    out += U_TO_UMLAUT_DISPLAY[ch] || ch
  }
  return out
}

function usesUmlautUBare(bare: string): boolean {
  return bare === 'u' || bare.startsWith('u')
}

function sliceOriginalByBareRange(full: string, startBare: number, endBare: number): string {
  let bareCount = 0
  let startIdx = 0
  let endIdx = full.length

  for (let i = 0; i < full.length; i++) {
    if (bareCount === startBare) startIdx = i
    const mapped = TONE_VOWELS[full[i]]
    bareCount += mapped ? mapped.base.length : 1
    if (bareCount === endBare) {
      endIdx = i + 1
      break
    }
  }
  return full.slice(startIdx, endIdx)
}

function buildParts(
  full: string,
  initialBare: string,
  medialBare: string,
  finalBare: string,
): PinyinPart[] {
  const parts: PinyinPart[] = []
  let barePos = 0
  const jqx = isJqx(initialBare)

  function pushPart(kind: PinyinPartKind, bare: string): void {
    if (!bare) return
    let display = sliceOriginalByBareRange(full, barePos, barePos + bare.length)
    const umlaut = jqx && usesUmlautUBare(bare)
    if (umlaut) display = toUmlautDisplay(display)
    parts.push({
      kind,
      bare,
      display,
      usesUmlautU: umlaut || undefined,
    })
    barePos += bare.length
  }

  pushPart('initial', initialBare)
  pushPart('medial', medialBare)
  pushPart('final', finalBare)
  return parts
}

export function parsePinyinBreakdown(pinyin: string): PinyinBreakdown | null {
  const full = pinyin.trim()
  if (!full) return null

  const bare = normalizeBare(full)
  const tone = detectTone(full)
  const toneLabel = TONE_LABELS[tone] || TONE_LABELS[5]
  const toneHint = TONE_HINTS[tone] || TONE_HINTS[5]

  if (WHOLE_SYLLABLES.has(bare)) {
    return {
      full,
      parts: [{ kind: 'final', bare, display: full }],
      tone,
      toneLabel,
      toneHint,
      canBreakdown: false,
      isWholeSyllable: true,
      wholeSyllableNote: '这是整体认读音节，直接读就好啦！',
    }
  }

  const { initial, rhyme } = splitInitial(bare)
  if (!rhyme) {
    return {
      full,
      parts: [{ kind: 'final', bare, display: full }],
      tone,
      toneLabel,
      toneHint,
      canBreakdown: false,
      isWholeSyllable: false,
      wholeSyllableNote: '',
    }
  }

  const { medial, final } = splitRhyme(rhyme, initial)
  const parts = buildParts(full, initial, medial, final)

  return {
    full,
    parts,
    tone,
    toneLabel,
    toneHint,
    canBreakdown: parts.length > 1,
    isWholeSyllable: false,
    wholeSyllableNote: '',
  }
}

export const PINYIN_AGE_MODE_OPTIONS = [
  { key: PinyinAgeMode.Young, label: '4–6 岁（拼一拼）' },
  { key: PinyinAgeMode.Advanced, label: '7–10 岁（含声调说明）' },
] as const

export function partKindClass(kind: PinyinPartKind): string {
  return kind
}
