import {
  DailyTaskPlan,
  HanziCharacter,
  HanziWithProgress,
  MasteryLevel,
  StudyMode,
  newCharactersPerDay,
  RANDOM_CHECK_PER_DAY,
  REVIEW_CHARACTERS_PER_DAY,
} from '../models'
import { forgettingRate } from '../models'
import { isDue } from './spacedRepetitionService'

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildDailyPlan(
  mode: StudyMode,
  catalog: HanziCharacter[],
  progress: Record<string, HanziWithProgress>,
  nowMs: number = Date.now(),
): DailyTaskPlan {
  const unlearned = catalog.filter((c) => {
    const p = progress[c.id]
    return !p || p.mastery === MasteryLevel.Unlearned
  })
  const newChars = unlearned.slice(0, newCharactersPerDay(mode))

  const dueForReview = catalog.filter((item) => {
    const p = progress[item.id]
    if (!p || p.mastery === MasteryLevel.Unlearned) return false
    return isDue(p.nextReviewAt, nowMs) || p.inIntensiveReview
  })

  const sortedByForgetting = [...dueForReview].sort((lhs, rhs) => {
    const lProgress = progress[lhs.id]
    const rProgress = progress[rhs.id]
    const lMemory = lProgress ? lProgress.memory : { correctCount: 0, wrongCount: 0 }
    const rMemory = rProgress ? rProgress.memory : { correctCount: 0, wrongCount: 0 }
    const lRate = forgettingRate(lMemory)
    const rRate = forgettingRate(rMemory)
    if (lRate !== rRate) return rRate - lRate
    const lIntensive = lProgress ? lProgress.inIntensiveReview : false
    const rIntensive = rProgress ? rProgress.inIntensiveReview : false
    return (lIntensive && !rIntensive) ? -1 : (rIntensive && !lIntensive) ? 1 : 0
  })

  const review = sortedByForgetting.slice(0, REVIEW_CHARACTERS_PER_DAY)

  const masteredOrLearning = catalog.filter((c) => {
    const p = progress[c.id]
    return p && p.mastery >= MasteryLevel.Familiar
  })
  const randomCheck = shuffle(masteredOrLearning).slice(0, RANDOM_CHECK_PER_DAY)

  return {
    newCharacters: newChars,
    reviewCharacters: review,
    randomCheckCharacters: randomCheck,
  }
}
