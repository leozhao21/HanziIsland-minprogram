import { loadCatalog, getCatalogById } from '../data/characterCatalogRepository'
import { fetchAllProgress, saveProgress, defaultProgress, buildProgressMapFromEntities } from '../data/progressRepository'
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
import { forcePullFromCloud, reconcileCloudSync, uploadLocalProgress } from '../data/cloudSyncRepository'
import {
  clearSession,
  getSavedSession,
  isLoggedIn,
  loginWithWeChat,
  type CloudUserSession,
} from '../services/authService'
import { buildDailyPlan } from '../domain/services/dailyTaskService'
import { generateMixedSession } from '../domain/services/quizGeneratorService'
import { applyAnswerRecord } from '../domain/useCases/recordAnswerUseCase'
import { computeParentStats } from '../domain/useCases/parentStatsUseCase'
import {
  clampDailyGoal,
  CharacterProgressEntity,
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
  UserProfileEntity,
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
  cloudUser: CloudUserSession | null
  cloudSyncStatus: string
  lastCloudSyncAt: number | null
  private sessionStudiedCharacterIds: Set<string>
  private listeners: Set<Listener>
  private cloudSyncTimer: number | null

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
    this.cloudUser = getSavedSession()
    this.cloudSyncStatus = this.cloudUser ? '同步已开启，将自动备份' : '未开启'
    this.lastCloudSyncAt = null
    this.sessionStudiedCharacterIds = new Set<string>()
    this.listeners = new Set<Listener>()
    this.cloudSyncTimer = null
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

      if (isLoggedIn()) {
        // 等待对账完成，避免页面先读到空进度
        await this.syncWithCloud().catch(() => {
          /* 启动同步失败不阻断本地使用 */
        })
      }
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : '加载失败'
      this.loadStatus = '加载失败'
      this.isLoaded = false
      this.notify()
    }
  }

  private reloadFromLocalStorage(): void {
    if (!this.catalog.length) {
      this.catalog = loadCatalog()
      this.catalogById = getCatalogById()
    }
    this.progressMap = fetchAllProgress(this.catalogById)
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
    this.reloadStudyTrend()
  }

  /** 用云端 payload 直接灌入内存，避免仅依赖 storage 回读失败 */
  private applyCloudPayloadToStore(payload: {
    progress: CharacterProgressEntity[]
    profile: UserProfileEntity
  }): number {
    if (!this.catalog.length) {
      this.catalog = loadCatalog()
      this.catalogById = getCatalogById()
    }
    this.progressMap = buildProgressMapFromEntities(payload.progress || [], this.catalogById)
    const profile = payload.profile
    if (profile) {
      this.studyMode = profile.studyModeRaw as StudyMode
      this.dailyLearningGoal = profileToDailyGoal(profile)
      this.starCount = profile.starCount
      this.unlockedIslands = profile.unlockedIslandIds || []
      this.pinyinBreakdownEnabled = profile.pinyinBreakdownEnabled !== false
      this.pinyinAgeMode = (profile.pinyinAgeModeRaw as PinyinAgeMode) || PinyinAgeMode.Young
      this.homeWelcomeSpeechEnabled = profile.homeWelcomeSpeechEnabled !== false
    }
    this.refreshDailyPlan()
    this.reloadTodayProgress()
    this.reloadStudyTrend()
    return Object.keys(this.progressMap).length
  }

  scheduleCloudUpload(): void {
    if (!isLoggedIn()) return
    if (this.cloudSyncTimer) clearTimeout(this.cloudSyncTimer)
    this.cloudSyncTimer = setTimeout(() => {
      this.cloudSyncTimer = null
      this.uploadProgressToCloud().catch(() => {
        this.cloudSyncStatus = '自动同步失败'
        this.notify()
      })
    }, 2500) as unknown as number
  }

  /** 是否已开启云端同步（已登录即视为开启，之后本地变更自动上传） */
  get isCloudSyncEnabled(): boolean {
    return isLoggedIn() && !!this.cloudUser
  }

  async loginAndSync(): Promise<CloudUserSession> {
    this.cloudSyncStatus = '正在授权登录…'
    this.notify()
    const session = await loginWithWeChat()
    this.cloudUser = session
    this.cloudSyncStatus = '登录成功，正在同步…'
    this.notify()
    await this.syncWithCloud()
    this.cloudSyncStatus = '同步已开启，将自动备份'
    this.notify()
    return session
  }

  logoutCloud(): void {
    if (this.cloudSyncTimer) {
      clearTimeout(this.cloudSyncTimer)
      this.cloudSyncTimer = null
    }
    clearSession()
    this.cloudUser = null
    this.cloudSyncStatus = '未开启'
    this.lastCloudSyncAt = null
    this.notify()
  }

  async syncWithCloud(): Promise<'pulled' | 'pushed' | 'noop'> {
    if (!isLoggedIn()) {
      this.cloudSyncStatus = '未开启'
      this.notify()
      throw new Error('未开启同步')
    }
    this.cloudSyncStatus = '正在同步…'
    this.notify()
    try {
      const result = await reconcileCloudSync()
      if (result.action === 'pulled') {
        const mapped = this.applyCloudPayloadToStore(result.payload)
        this.cloudSyncStatus = mapped > 0
          ? `已从云端恢复 ${mapped} 字，自动同步已开启`
          : '已从云端恢复，自动同步已开启'
      } else if (result.action === 'pushed') {
        this.cloudSyncStatus = '已上传到云端，自动同步已开启'
      } else {
        this.cloudSyncStatus = '已是最新，自动同步已开启'
      }
      this.lastCloudSyncAt = Date.now()
      this.cloudUser = getSavedSession()
      this.notify()
      return result.action
    } catch (e) {
      this.cloudSyncStatus = e instanceof Error ? e.message : '同步失败'
      this.notify()
      throw e
    }
  }

  /** 强制从云端覆盖本地 */
  async restoreFromCloud(): Promise<{ progressCount: number }> {
    if (!isLoggedIn()) {
      this.cloudSyncStatus = '未开启'
      this.notify()
      throw new Error('未开启同步')
    }
    this.cloudSyncStatus = '正在从云端恢复…'
    this.notify()
    try {
      // 恢复前取消待上传任务，避免空本地随后盖回云端
      if (this.cloudSyncTimer) {
        clearTimeout(this.cloudSyncTimer)
        this.cloudSyncTimer = null
      }
      const payload = await forcePullFromCloud()
      const mapped = this.applyCloudPayloadToStore(payload)
      const count = payload.progressCount || mapped
      if (mapped === 0 && count > 0) {
        throw new Error(`已写入${count}条，但字库未匹配到汉字，请检查字库资源`)
      }
      this.cloudSyncStatus = count > 0 ? `已恢复 ${count} 个汉字进度` : '云端暂无汉字学习记录'
      this.lastCloudSyncAt = Date.now()
      this.cloudUser = getSavedSession()
      this.notify()
      return { progressCount: count }
    } catch (e) {
      this.cloudSyncStatus = e instanceof Error ? e.message : '恢复失败'
      this.notify()
      throw e
    }
  }

  async uploadProgressToCloud(force = false): Promise<void> {
    if (!isLoggedIn()) return
    this.cloudSyncStatus = '正在上传…'
    this.notify()
    try {
      await uploadLocalProgress(force)
      this.cloudSyncStatus = '已上传到云端'
      this.lastCloudSyncAt = Date.now()
      this.notify()
    } catch (e) {
      this.cloudSyncStatus = e instanceof Error ? e.message : '上传失败'
      this.notify()
      throw e
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
    this.scheduleCloudUpload()
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
    this.scheduleCloudUpload()
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
    this.scheduleCloudUpload()
  }

  setPinyinBreakdownEnabled(enabled: boolean): void {
    this.pinyinBreakdownEnabled = enabled
    const profile = fetchOrCreateProfile()
    profile.pinyinBreakdownEnabled = enabled
    saveProfile(profile)
    this.notify()
    this.scheduleCloudUpload()
  }

  setPinyinAgeMode(mode: PinyinAgeMode): void {
    this.pinyinAgeMode = mode
    const profile = fetchOrCreateProfile()
    profile.pinyinAgeModeRaw = mode
    saveProfile(profile)
    this.notify()
    this.scheduleCloudUpload()
  }

  setHomeWelcomeSpeechEnabled(enabled: boolean): void {
    this.homeWelcomeSpeechEnabled = enabled
    const profile = fetchOrCreateProfile()
    profile.homeWelcomeSpeechEnabled = enabled
    saveProfile(profile)
    this.notify()
    this.scheduleCloudUpload()
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
    this.scheduleCloudUpload()
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
    this.scheduleCloudUpload()
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
    this.scheduleCloudUpload()
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
