import {
  HanziCharacter,
  HanziWithProgress,
  MasteryLevel,
  ParentDashboardStats,
} from '../models'

export function computeParentStats(
  catalog: HanziCharacter[],
  progress: Record<string, HanziWithProgress>,
  weeklyMasteredIds: string[],
): ParentDashboardStats {
  const values = Object.values(progress)
  const learned = values.filter((p) => p.mastery >= MasteryLevel.Learning).length
  const mastered = values.filter((p) => p.mastery >= MasteryLevel.Mastered).length
  const inReview = values.filter(
    (p) => p.mastery >= MasteryLevel.Familiar && p.mastery < MasteryLevel.Mastered,
  ).length
  const forgetful = values.filter((p) => {
    const total = p.memory.correctCount + p.memory.wrongCount
    return total > 0 && p.memory.wrongCount / total > 0.4
  }).length

  const weeklyChars = weeklyMasteredIds
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is HanziCharacter => !!c)

  return {
    totalLearned: learned,
    trulyMastered: mastered,
    inReview,
    easyToForget: forgetful,
    weeklyNewMastered: weeklyChars,
    weeklyMasteredCount: weeklyChars.length,
  }
}
