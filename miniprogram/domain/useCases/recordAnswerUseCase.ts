import { adjustMastery, HanziWithProgress, MasteryLevel } from '../models'
import { recordMemory } from '../models'
import { nextReviewDate } from '../services/spacedRepetitionService'

export function applyAnswerRecord(
  progress: HanziWithProgress,
  correct: boolean,
  nowMs: number = Date.now(),
): HanziWithProgress {
  const memory = recordMemory(progress.memory, correct)
  let mastery = adjustMastery(correct, progress.mastery)

  if (mastery === MasteryLevel.Unlearned && correct) {
    mastery = MasteryLevel.Learning
  }

  const { date, step } = nextReviewDate(correct, progress.intervalStep, nowMs)

  let inIntensiveReview = progress.inIntensiveReview
  if (!correct) {
    inIntensiveReview = true
  } else if (mastery >= MasteryLevel.Good) {
    inIntensiveReview = false
  }

  return {
    ...progress,
    memory,
    mastery,
    nextReviewAt: date,
    intervalStep: step,
    inIntensiveReview,
  }
}
