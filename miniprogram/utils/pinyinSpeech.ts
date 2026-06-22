import { HanziCharacter } from '../domain/models'
import { PinyinBreakdown, PinyinPart, PinyinPartKind } from './pinyinBreakdown'

/** 用常见汉字示范拼音发音，避免 TTS 把 j/a 读成英文字母 */
const INITIAL_SPOKEN: Record<string, string> = {
  b: '波',
  p: '坡',
  m: '摸',
  f: '佛',
  d: '得',
  t: '特',
  n: '呢',
  l: '勒',
  g: '哥',
  k: '科',
  h: '喝',
  j: '鸡',
  q: '七',
  x: '西',
  zh: '知',
  ch: '吃',
  sh: '师',
  r: '日',
  z: '资',
  c: '次',
  s: '思',
  y: '衣',
  w: '乌',
}

const MEDIAL_SPOKEN: Record<string, string> = {
  i: '衣',
  u: '乌',
  v: '于',
}

const FINAL_SPOKEN: Record<string, string> = {
  a: '啊',
  o: '喔',
  e: '鹅',
  ai: '哀',
  ei: '诶',
  ao: '熬',
  ou: '欧',
  an: '安',
  en: '恩',
  ang: '昂',
  eng: '亨',
  ong: '翁',
  er: '儿',
  i: '衣',
  u: '乌',
  v: '于',
  ia: '呀',
  ie: '耶',
  iao: '腰',
  iu: '优',
  ian: '烟',
  in: '因',
  iang: '羊',
  ing: '英',
  iong: '拥',
  ua: '蛙',
  uo: '窝',
  uai: '歪',
  ui: '威',
  uan: '弯',
  un: '温',
  uang: '汪',
  ueng: '翁',
  ue: '约',
}

/** j/q/x 后 u 系列韵母（实际为 ü）的示范读音 */
const JQX_UMLAUT_SPOKEN: Record<string, string> = {
  u: '于',
  ue: '约',
  uan: '冤',
  un: '晕',
}

const PART_KIND_LABEL: Record<PinyinPartKind, string> = {
  initial: '声母',
  medial: '介音',
  final: '韵母',
}

function spokenForUmlautPart(part: PinyinPart): string | null {
  if (!part.usesUmlautU) return null
  return JQX_UMLAUT_SPOKEN[part.bare] || '于'
}

export function spokenTextForPart(part: PinyinPart, initialBare = ''): string {
  if (part.kind === 'initial') {
    return INITIAL_SPOKEN[part.bare] || part.display
  }

  const umlautSpoken = spokenForUmlautPart(part)
  if (umlautSpoken) return umlautSpoken

  if (part.kind === 'medial') {
    return MEDIAL_SPOKEN[part.bare] || part.display
  }
  return FINAL_SPOKEN[part.bare] || part.display
}

export function buildPinyinBreakdownSpeech(
  character: HanziCharacter,
  breakdown: PinyinBreakdown,
  ageMode: 'young' | 'advanced',
): string[] {
  if (breakdown.isWholeSyllable) {
    return [
      breakdown.wholeSyllableNote || '这是整体认读音节。',
      '读：' + character.character,
    ]
  }

  const initialBare = breakdown.parts.find((p) => p.kind === 'initial')?.bare || ''
  const lines: string[] = []

  if (ageMode === 'advanced') {
    lines.push('我们来拼一拼这个字的读音。')
    breakdown.parts.forEach((part) => {
      lines.push(
        PART_KIND_LABEL[part.kind] + '读「' + spokenTextForPart(part, initialBare) + '」。',
      )
    })
    lines.push(breakdown.toneLabel + '。' + breakdown.toneHint)
    lines.push('连起来读：' + character.character + '。')
    return lines
  }

  lines.push('拼一拼。')
  breakdown.parts.forEach((part) => {
    lines.push(spokenTextForPart(part, initialBare))
  })
  lines.push('连起来读，' + character.character)
  return lines
}
