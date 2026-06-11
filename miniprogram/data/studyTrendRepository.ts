import { DailyStudySnapshot } from '../domain/models'
import { getStorage, isSameDay, setStorage, startOfDay, STORAGE_KEYS } from './storage'

interface SnapshotEntity {
  dayStart: number
  charactersStudied: number
  questionsAnswered: number
  correctCount: number
  wrongCount: number
  newMasteredCount: number
  cumulativeMastered: number
  cumulativeLearned: number
  averageForgettingRate: number
}

function entityToModel(e: SnapshotEntity): DailyStudySnapshot {
  return { ...e }
}

function emptySnapshot(dayStart: number): SnapshotEntity {
  return {
    dayStart,
    charactersStudied: 0,
    questionsAnswered: 0,
    correctCount: 0,
    wrongCount: 0,
    newMasteredCount: 0,
    cumulativeMastered: 0,
    cumulativeLearned: 0,
    averageForgettingRate: 0,
  }
}

function loadSnapshots(): SnapshotEntity[] {
  return getStorage<SnapshotEntity[]>(STORAGE_KEYS.snapshots, [])
}

function saveSnapshots(snapshots: SnapshotEntity[]): void {
  setStorage(STORAGE_KEYS.snapshots, snapshots)
}

function fetchOrCreateToday(): SnapshotEntity {
  const snapshots = loadSnapshots()
  const day = startOfDay()
  const existing = snapshots.find((s) => isSameDay(s.dayStart, day))
  if (existing) return existing
  const entity = emptySnapshot(day)
  snapshots.push(entity)
  saveSnapshots(snapshots)
  return entity
}

function updateToday(mutator: (s: SnapshotEntity) => void): void {
  const snapshots = loadSnapshots()
  const day = startOfDay()
  let idx = snapshots.findIndex((s) => isSameDay(s.dayStart, day))
  if (idx < 0) {
    snapshots.push(emptySnapshot(day))
    idx = snapshots.length - 1
  }
  mutator(snapshots[idx])
  saveSnapshots(snapshots)
}

export function recordAnswerSnapshot(params: {
  correct: boolean
  masteredCount: number
  learnedCount: number
  averageForgettingRate: number
  becameMastered: boolean
}): void {
  updateToday((s) => {
    s.questionsAnswered += 1
    if (params.correct) s.correctCount += 1
    else s.wrongCount += 1
    s.cumulativeMastered = params.masteredCount
    s.cumulativeLearned = params.learnedCount
    s.averageForgettingRate = params.averageForgettingRate
    if (params.becameMastered) s.newMasteredCount += 1
  })
}

export function recordCharactersStudied(ids: string[]): void {
  if (ids.length === 0) return
  updateToday((s) => {
    s.charactersStudied += ids.length
  })
}

export function fetchToday(): DailyStudySnapshot {
  return entityToModel(fetchOrCreateToday())
}

export function fetchLastDays(days: number): DailyStudySnapshot[] {
  if (days <= 0) return []
  const snapshots = loadSnapshots()
  const end = startOfDay()
  const result: DailyStudySnapshot[] = []

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = end - offset * 86400000
    const key = startOfDay(day)
    const existing = snapshots.find((s) => isSameDay(s.dayStart, key))
    result.push(existing ? entityToModel(existing) : entityToModel(emptySnapshot(key)))
  }
  return result
}

export function chartData(days = 14): { dailyVolume: DailyStudySnapshot[]; masteredGrowth: DailyStudySnapshot[]; forgettingTrend: DailyStudySnapshot[] } {
  const snapshots = fetchLastDays(days)
  return {
    dailyVolume: snapshots,
    masteredGrowth: snapshots,
    forgettingTrend: snapshots,
  }
}
