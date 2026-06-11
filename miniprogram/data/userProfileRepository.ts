import {
  DailyLearningGoal,
  recommendedDailyGoal,
  StudyMode,
  UserProfileEntity,
} from '../domain/models'
import { getStorage, setStorage, STORAGE_KEYS } from './storage'

const DEFAULT_PROFILE: UserProfileEntity = {
  starCount: 0,
  studyModeRaw: StudyMode.Standard,
  unlockedIslandIds: [],
  weeklyMasteredIds: [],
  dailyLearningGoal: recommendedDailyGoal(StudyMode.Standard),
  followStudyModeGoal: true,
}

export function fetchOrCreateProfile(): UserProfileEntity {
  const profile = getStorage<UserProfileEntity>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  if (profile.dailyLearningGoal < 5) {
    profile.dailyLearningGoal = recommendedDailyGoal(profile.studyModeRaw as StudyMode)
    profile.followStudyModeGoal = true
    setStorage(STORAGE_KEYS.profile, profile)
  }
  return profile
}

export function saveProfile(profile: UserProfileEntity): void {
  setStorage(STORAGE_KEYS.profile, profile)
}

export function addStars(count: number): UserProfileEntity {
  const profile = fetchOrCreateProfile()
  profile.starCount += count
  saveProfile(profile)
  return profile
}

export function recordWeeklyMastered(characterId: string): void {
  const profile = fetchOrCreateProfile()
  if (!profile.weeklyMasteredIds.includes(characterId)) {
    profile.weeklyMasteredIds.push(characterId)
    saveProfile(profile)
  }
}

export function profileToDailyGoal(profile: UserProfileEntity): DailyLearningGoal {
  return {
    targetCount: profile.dailyLearningGoal,
    followStudyMode: profile.followStudyModeGoal,
  }
}

export function applyDailyGoalToProfile(profile: UserProfileEntity, goal: DailyLearningGoal): UserProfileEntity {
  profile.dailyLearningGoal = goal.targetCount
  profile.followStudyModeGoal = goal.followStudyMode
  saveProfile(profile)
  return profile
}
