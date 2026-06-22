import { loadCatalog, getCatalogById } from '../data/characterCatalogRepository'
import { fetchAllProgress, saveProgress, defaultProgress } from '../data/progressRepository'
import {
  addStars,
  applyDailyGoalToProfile,
  fetchOrCreateProfile,
  profileToDailyGoal,
  recordWeeklyMastered,
  saveProfile,
} from '../data/userProfileRepository'
import {
  chartData,
  fetchToday,
  recordAnswerSnapshot,
  recordCharactersStudied,
} from '../data/studyTrendRepository'
import { buildDailyPlan } from '../domain/services/dailyTaskService'
import { generateMixedSession } from '../domain/services/quizGeneratorService'
import { applyAnswerRecord } from '../domain/useCases/recordAnswerUseCase'
import { computeParentStats } from '../domain/useCases/parentStatsUseCase'
import {
  clampDailyGoal,
  DailyLearningGoal,
  DailyTaskPlan,
  HanziCharacter,
  HanziWithProgress,
  IslandTheme,
  ISLAND_CATALOG,
  LearnedListFilter,
  LearnedTabStats,
  LearnSession,
  MasteryBadge,
  MASTERY_BADGES,
  MasteryLevel,
  ParentDashboardStats,
  PinyinAgeMode,
  planTotalCount,
  QuizQuestion,
  quizTypesForMode,
  recommendedDailyGoal,
  StudyMode,
  StudyTrendChartData,
  TodayLearningProgress,
} from '../domain/models'

type Listener = () => void

class AppStore {
  catalog: HanziCharacter[]
  private catalogById: Record<string, HanziCharacter>
  progressMap: Record<string, HanziWithProgress>
  dailyPlan: DailyTaskPlan | null
  studyMode: StudyMode
  dailyLearningGoal: DailyLearningGoal
  todayProgress: TodayLearningProgress
  starCount: number
  unlockedIslands: string[]
  isLoaded: boolean
  loadError: string | null
  loadStatus: string
  studyTrend: StudyTrendChartData
  pendingSession: LearnSession | null
  pinyinBreakdownEnabled: boolean
  pinyinAgeMode: PinyinAgeMode
  homeWelcomeSpeechEnabled: boolean
  private sessionStudiedCharacterIds: Set<string>
  private listeners: Set<Listener>

  constructor() {
    this.catalog = []
    this.catalogById = {}
    this.progressMap = {}
    this.dailyPlan = null
    this.studyMode = StudyMode.Standard
    this.dailyLearningGoal = {
      targetCount: recommendedDailyGoal(StudyMode.Standard),
      followStudyMode: true,
    }
    this.todayProgress = {
      goal: 20,
      charactersStudied: 0,
      questionsAnswered: 0,
      correctCount: 0,
      newMasteredCount: 0,
    }
    this.starCount = 0
    this.unlockedIslands = []
    this.isLoaded = false
    this.loadError = null
    this.loadStatus = '正在启动…'
    this.studyTrend = { dailyVolume: [], masteredGrowth: [], forgettingTrend: [] }
    this.pendingSession = null
    this.pinyinBreakdownEnabled = true
    this.pinyinAgeMode = PinyinAgeMode.Young
    this.homeWelcomeSpeechEnabled = true
    this.sessionStudiedCharacterIds = new Set<string>()
    this.listeners = new Set<Listener>()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(): void {
    this.listeners.forEach((fn) => fn())
  }

  async load(): Promise<void> {
    this.loadError = null
    try {
      this.loadStatus = '正在加载字库…'
      this.notify()
      this.catalog = loadCatalog()
      this.catalogById = getCatalogById()

      this.loadStatus = '正在读取学习记录…'
      this.notify()
      this.progressMap = fetchAllProgress(this.catalogById)

      this.loadStatus = '正在准备今日任务…'
      this.notify()
      const profile = fetchOrCreateProfile()
      this.studyMode = profile.studyModeRaw as StudyMode
      this.dailyLearningGoal = profileToDailyGoal(profile)
      this.starCount = profile.starCount
      this.unlockedIslands = profile.unlockedIslandIds
      this.pinyinBreakdownEnabled = profile.pinyinBreakdownEnabled !== false
      this.pinyinAgeMode = (profile.pinyinAgeModeRaw as PinyinAgeMode) || PinyinAgeMode.Young
      this.homeWelcomeSpeechEnabled = profile.homeWelcomeSpeechEnabled !== false

      this.refreshDailyPlan()
      this.reloadTodayProgress()

      this.isLoaded = true
      this.loadStatus = '完成'
      this.notify()

      setTimeout(() => {
        this.reloadStudyTrend()
        this.notify()
      }, 0)
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : '加载失败'
      this.loadStatus = '加载失败'
      this.isLoaded = false
      this.notify()
    }
  }

  progressFor(characterId: string): HanziWithProgress | null {
    if (this.progressMap[characterId]) return this.progressMap[characterId]
    const character = this.catalogById[characterId]
    if (!character) return null
    return defaultProgress(character)
  }

  masteryFor(characterId: string): MasteryLevel {
    const item = this.progressFor(characterId)
    return item ? item.mastery : MasteryLevel.Unlearned
  }

  reloadStudyTrend(): void {
    this.studyTrend = chartData(14)
  }

  reloadTodayProgress(): void {
    const snapshot = fetchToday()
    this.todayProgress = {
      goal: this.dailyLearningGoal.targetCount,
      charactersStudied: snapshot.charactersStudied,
      questionsAnswered: snapshot.questionsAnswered,
      correctCount: snapshot.correctCount,
      newMasteredCount: snapshot.newMasteredCount,
    }
  }

  get recommendedDailyGoal(): number {
    return recommendedDailyGoal(this.studyMode)
  }

  updateDailyLearningGoal(targetCount: number): void {
    const goal = clampDailyGoal({
      targetCount,
      followStudyMode: false,
    })
    this.applyDailyLearningGoal(goal)
  }

  setFollowStudyModeGoal(enabled: boolean): void {
    const goal: DailyLearningGoal = {
      targetCount: enabled ? this.recommendedDailyGoal : this.dailyLearningGoal.targetCount,
      followStudyMode: enabled,
    }
    this.applyDailyLearningGoal(goal)
  }

  applyRecommendedDailyGoal(): void {
    this.applyDailyLearningGoal({
      targetCount: this.recommendedDailyGoal,
      followStudyMode: true,
    })
  }

  private applyDailyLearningGoal(goal: DailyLearningGoal): void {
    const clamped = clampDailyGoal(goal)
    this.dailyLearningGoal = clamped
    const profile = fetchOrCreateProfile()
    applyDailyGoalToProfile(profile, clamped)
    this.reloadTodayProgress()
    this.notify()
  }

  beginStudySession(characterIds: string[]): void {
    characterIds.forEach((id) => this.sessionStudiedCharacterIds.add(id))
  }

  endStudySession(): void {
    if (this.sessionStudiedCharacterIds.size === 0) return
    recordCharactersStudied([...this.sessionStudiedCharacterIds])
    this.sessionStudiedCharacterIds.clear()
    this.reloadStudyTrend()
    this.reloadTodayProgress()
    this.notify()
  }

  private get averageForgettingRate(): number {
    const active = Object.values(this.progressMap).filter((p) => p.mastery >= MasteryLevel.Learning)
    if (active.length === 0) return 0
    return active.reduce((sum, p) => {
      const total = p.memory.correctCount + p.memory.wrongCount
      return sum + (total > 0 ? p.memory.wrongCount / total : 0)
    }, 0) / active.length
  }

  private get learnedCount(): number {
    return Object.values(this.progressMap).filter((p) => p.mastery >= MasteryLevel.Learning).length
  }

  refreshDailyPlan(): void {
    this.dailyPlan = buildDailyPlan(this.studyMode, this.catalog, this.progressMap)
  }

  updateStudyMode(mode: StudyMode): void {
    this.studyMode = mode
    const profile = fetchOrCreateProfile()
    profile.studyModeRaw = mode
    if (this.dailyLearningGoal.followStudyMode) {
      profile.dailyLearningGoal = recommendedDailyGoal(mode)
      profile.followStudyModeGoal = true
      this.dailyLearningGoal.targetCount = profile.dailyLearningGoal
      this.dailyLearningGoal.followStudyMode = true
    }
    saveProfile(profile)
    this.refreshDailyPlan()
    this.reloadTodayProgress()
    this.notify()
  }

  setPinyinBreakdownEnabled(enabled: boolean): void {
    this.pinyinBreakdownEnabled = enabled
    const profile = fetchOrCreateProfile()
    profile.pinyinBreakdownEnabled = enabled
    saveProfile(profile)
    this.notify()
  }

  setPinyinAgeMode(mode: PinyinAgeMode): void {
    this.pinyinAgeMode = mode
    const profile = fetchOrCreateProfile()
    profile.pinyinAgeModeRaw = mode
    saveProfile(profile)
    this.notify()
  }

  setHomeWelcomeSpeechEnabled(enabled: boolean): void {
    this.homeWelcomeSpeechEnabled = enabled
    const profile = fetchOrCreateProfile()
    profile.homeWelcomeSpeechEnabled = enabled
    saveProfile(profile)
    this.notify()
  }

  makeQuizSession(
    characters: HanziCharacter[],
    count: number,
    requiredCharacters: HanziCharacter[] = [],
  ): QuizQuestion[] {
    return generateMixedSession(
      characters,
      count,
      quizTypesForMode(this.studyMode),
      requiredCharacters,
      this.catalog,
    )
  }

  makeDailyStudySession(plan: DailyTaskPlan): LearnSession {
    const all = [...plan.newCharacters, ...plan.reviewCharacters, ...plan.randomCheckCharacters]
    const questionCount = Math.max(plan.newCharacters.length, Math.min(all.length, 10))
    const questions = this.makeQuizSession(all, questionCount, plan.newCharacters)
    this.beginStudySession(all.map((c) => c.id))
    return {
      id: `${Date.now()}`,
      questions,
      learnCharacters: plan.newCharacters,
      currentLearnIndex: 0,
    }
  }

  makeDailyLearnSession(): LearnSession | null {
    if (!this.dailyPlan || planTotalCount(this.dailyPlan) === 0) return null
    return this.makeDailyStudySession(this.dailyPlan)
  }

  markCharacterIntroduced(characterId: string): void {
    const item = this.progressFor(characterId)
    if (!item || item.mastery !== MasteryLevel.Unlearned) return
    const updated = { ...item, mastery: MasteryLevel.Learning }
    this.progressMap[characterId] = updated
    saveProgress(updated)
    this.refreshDailyPlan()
    this.notify()
  }

  makeIntensiveReviewSession(): LearnSession | null {
    const chars = this.intensiveReviewCharacters
    if (chars.length === 0) return null
    const questions = this.makeQuizSession(chars, Math.min(chars.length, 10))
    if (questions.length === 0) return null
    this.beginStudySession(chars.map((c) => c.id))
    return {
      id: `${Date.now()}`,
      questions,
      learnCharacters: [],
      currentLearnIndex: 0,
    }
  }

  get intensiveReviewCharacters(): HanziCharacter[] {
    return Object.values(this.progressMap)
      .filter((p) => p.inIntensiveReview)
      .sort((a, b) => {
        const aTotal = a.memory.correctCount + a.memory.wrongCount
        const bTotal = b.memory.correctCount + b.memory.wrongCount
        const aRate = aTotal > 0 ? a.memory.wrongCount / aTotal : 0
        const bRate = bTotal > 0 ? b.memory.wrongCount / bTotal : 0
        return bRate - aRate
      })
      .map((p) => p.character)
  }

  submitAnswer(characterId: string, correct: boolean): void {
    const item = this.progressFor(characterId)
    if (!item) return

    const previousMastery = item.mastery
    const updated = applyAnswerRecord(item, correct)
    this.progressMap[characterId] = updated
    saveProgress(updated)

    if (updated.mastery >= MasteryLevel.Mastered && previousMastery < MasteryLevel.Mastered) {
      recordWeeklyMastered(characterId)
    }

    if (correct) {
      const profile = addStars(1)
      this.starCount = profile.starCount
    }

    recordAnswerSnapshot({
      correct,
      masteredCount: this.masteredCount,
      learnedCount: this.learnedCount,
      averageForgettingRate: this.averageForgettingRate,
      becameMastered: updated.mastery >= MasteryLevel.Mastered && previousMastery < MasteryLevel.Mastered,
    })

    this.reloadStudyTrend()
    this.reloadTodayProgress()
    this.refreshDailyPlan()
    this.notify()
  }

  unlockIsland(theme: IslandTheme): boolean {
    if (this.starCount < theme.starCost || this.unlockedIslands.includes(theme.id)) return false
    const profile = fetchOrCreateProfile()
    if (profile.starCount < theme.starCost) return false
    profile.starCount -= theme.starCost
    profile.unlockedIslandIds.push(theme.id)
    saveProfile(profile)
    this.starCount = profile.starCount
    this.unlockedIslands = profile.unlockedIslandIds
    this.notify()
    return true
  }

  get parentDashboard(): ParentDashboardStats {
    const profile = fetchOrCreateProfile()
    return computeParentStats(this.catalog, this.progressMap, profile.weeklyMasteredIds)
  }

  get masteredCount(): number {
    return Object.values(this.progressMap).filter((p) => p.mastery >= MasteryLevel.Mastered).length
  }

  get earnedBadges(): MasteryBadge[] {
    return MASTERY_BADGES.filter((b) => this.masteredCount >= b.threshold)
  }

  get quizzedCharacters(): HanziWithProgress[] {
    return Object.values(this.progressMap).filter(
      (p) => p.memory.correctCount + p.memory.wrongCount > 0,
    )
  }

  get learnedTabStats(): LearnedTabStats {
    const quizzed = this.quizzedCharacters
    return {
      mastered: quizzed.filter((p) => p.mastery >= MasteryLevel.Mastered).length,
      inProgress: quizzed.filter(
        (p) => p.mastery >= MasteryLevel.Learning && p.mastery < MasteryLevel.Mastered && !p.inIntensiveReview,
      ).length,
      intensive: quizzed.filter((p) => p.inIntensiveReview).length,
    }
  }

  filteredLearnedCharacters(filter: LearnedListFilter): HanziWithProgress[] {
    const base = this.quizzedCharacters
    let filtered: HanziWithProgress[]
    switch (filter) {
      case LearnedListFilter.All:
        filtered = base
        break
      case LearnedListFilter.Mastered:
        filtered = base.filter((p) => p.mastery >= MasteryLevel.Mastered)
        break
      case LearnedListFilter.InProgress:
        filtered = base.filter(
          (p) => p.mastery >= MasteryLevel.Learning && p.mastery < MasteryLevel.Mastered && !p.inIntensiveReview,
        )
        break
      case LearnedListFilter.Intensive:
        filtered = base.filter((p) => p.inIntensiveReview)
        break
    }
    return filtered.sort((lhs, rhs) => {
      if (lhs.mastery !== rhs.mastery) return rhs.mastery - lhs.mastery
      return lhs.character.pinyin.localeCompare(rhs.character.pinyin, 'zh-CN')
    })
  }

  makeCharacterQuizSession(character: HanziCharacter): LearnSession {
    const questions = this.makeQuizSession([character], 3)
    this.beginStudySession([character.id])
    return {
      id: `${Date.now()}`,
      questions,
      learnCharacters: [],
      currentLearnIndex: 0,
    }
  }

  setPendingSession(session: LearnSession | null): void {
    this.pendingSession = session
  }

  consumePendingSession(): LearnSession | null {
    const s = this.pendingSession
    this.pendingSession = null
    return s
  }

  get islands(): IslandTheme[] {
    return ISLAND_CATALOG
  }

  getSnapshot() {
    return {
      isLoaded: this.isLoaded,
      loadError: this.loadError,
      loadStatus: this.loadStatus,
      starCount: this.starCount,
      unlockedIslands: this.unlockedIslands,
      studyMode: this.studyMode,
      dailyLearningGoal: this.dailyLearningGoal,
      todayProgress: this.todayProgress,
      dailyPlan: this.dailyPlan,
      masteredCount: this.masteredCount,
      learnedTabStats: this.learnedTabStats,
      parentDashboard: this.parentDashboard,
      recommendedDailyGoal: this.recommendedDailyGoal,
      intensiveReviewCount: this.intensiveReviewCharacters.length,
      studyTrend: this.studyTrend,
    }
  }
}

let storeInstance: AppStore | null = null

export function getStore(): AppStore {
  if (!storeInstance) storeInstance = new AppStore()
  return storeInstance
}

export type { AppStore }
