import {
  CharacterProgressEntity,
  HanziCharacter,
  HanziWithProgress,
  MasteryLevel,
  ZERO_MEMORY,
} from '../domain/models'
import { bumpLocalSyncUpdatedAt, getStorage, setStorage, STORAGE_KEYS } from './storage'

function entityToProgress(entity: CharacterProgressEntity, character: HanziCharacter): HanziWithProgress {
  return {
    character,
    mastery: entity.masteryRaw != null ? (entity.masteryRaw as MasteryLevel) : MasteryLevel.Unlearned,
    memory: { correctCount: entity.correctCount, wrongCount: entity.wrongCount },
    nextReviewAt: entity.nextReviewAt,
    intervalStep: entity.intervalStep,
    inIntensiveReview: entity.inIntensiveReview,
  }
}

function progressToEntity(progress: HanziWithProgress): CharacterProgressEntity {
  return {
    characterId: progress.character.id,
    masteryRaw: progress.mastery,
    correctCount: progress.memory.correctCount,
    wrongCount: progress.memory.wrongCount,
    nextReviewAt: progress.nextReviewAt,
    intervalStep: progress.intervalStep,
    inIntensiveReview: progress.inIntensiveReview,
    lastStudiedAt: Date.now(),
  }
}

export function fetchAllProgress(catalogById: Record<string, HanziCharacter>): Record<string, HanziWithProgress> {
  const entities = getStorage<CharacterProgressEntity[]>(STORAGE_KEYS.progress, [])
  return buildProgressMapFromEntities(entities, catalogById)
}

export function buildProgressMapFromEntities(
  entities: CharacterProgressEntity[],
  catalogById: Record<string, HanziCharacter>,
): Record<string, HanziWithProgress> {
  const list = Array.isArray(entities) ? entities : []
  const map: Record<string, HanziWithProgress> = {}
  for (const entity of list) {
    if (!entity || !entity.characterId) continue
    const char = catalogById[entity.characterId]
    if (char) map[entity.characterId] = entityToProgress(entity, char)
  }
  return map
}

export function replaceAllProgress(entities: CharacterProgressEntity[]): void {
  setStorage(STORAGE_KEYS.progress, Array.isArray(entities) ? entities : [])
  bumpLocalSyncUpdatedAt()
}

export function saveProgress(progress: HanziWithProgress): void {
  const entities = getStorage<CharacterProgressEntity[]>(STORAGE_KEYS.progress, [])
  const idx = entities.findIndex((e) => e.characterId === progress.character.id)
  const entity = progressToEntity(progress)
  if (idx >= 0) {
    entities[idx] = entity
  } else {
    entities.push(entity)
  }
  setStorage(STORAGE_KEYS.progress, entities)
  bumpLocalSyncUpdatedAt()
}

export function defaultProgress(character: HanziCharacter): HanziWithProgress {
  return {
    character,
    mastery: MasteryLevel.Unlearned,
    memory: ZERO_MEMORY,
    nextReviewAt: null,
    intervalStep: 0,
    inIntensiveReview: false,
  }
}
