const INTERVALS_IN_DAYS = [1, 3, 7, 15, 30]

export function nextReviewDate(
  afterCorrect: boolean,
  currentStep: number,
  fromMs: number = Date.now(),
): { date: number; step: number } {
  if (afterCorrect) {
    const step = Math.min(currentStep + 1, INTERVALS_IN_DAYS.length - 1)
    const days = INTERVALS_IN_DAYS[step]
    return { date: fromMs + days * 86400000, step }
  }
  const days = INTERVALS_IN_DAYS[0]
  return { date: fromMs + days * 86400000, step: 0 }
}

export function isDue(nextReviewAt: number | null, nowMs: number = Date.now()): boolean {
  if (nextReviewAt === null) return true
  return nextReviewAt <= nowMs
}
