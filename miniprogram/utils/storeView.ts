import { HanziWithProgress, MASTERY_TITLES, MasteryLevel } from '../domain/models'

export function masteryTitle(level: MasteryLevel): string {
  return MASTERY_TITLES[level]
}

export function learnedItemToView(item: HanziWithProgress) {
  let statusEmoji = '💪'
  if (item.mastery >= MasteryLevel.Mastered) statusEmoji = '🌟'
  else if (item.inIntensiveReview) statusEmoji = '🔥'
  return {
    id: item.character.id,
    character: item.character.character,
    pinyin: item.character.pinyin,
    sentence: item.character.sentence,
    masteryTitle: MASTERY_TITLES[item.mastery],
    statusEmoji,
    masteryRaw: item.mastery,
    correctCount: item.memory.correctCount,
    wrongCount: item.memory.wrongCount,
    inIntensiveReview: item.inIntensiveReview,
    nextReviewText: item.nextReviewAt ? formatRelative(item.nextReviewAt) : '',
  }
}

function formatRelative(ms: number): string {
  const diff = ms - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  if (days <= 7) return `${days} 天后`
  const d = new Date(ms)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function todayProgressPercent(studied: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((studied / goal) * 100))
}
