export interface HanziCharacter {
  id: string
  character: string
  pinyin: string
  meaning: string
  sentence: string
  level: number
  audio?: string | null
  strokeAnimation?: string | null
  components?: string[] | null
  decomposeHint?: string | null
  evolutionType?: string | null
  evolutionHint?: string | null
}

export enum MasteryLevel {
  Unlearned = 0,
  Learning = 1,
  Familiar = 2,
  Good = 3,
  Proficient = 4,
  Mastered = 5,
}

export const MASTERY_TITLES: Record<MasteryLevel, string> = {
  [MasteryLevel.Unlearned]: '未学习',
  [MasteryLevel.Learning]: '学习中',
  [MasteryLevel.Familiar]: '初步认识',
  [MasteryLevel.Good]: '基本掌握',
  [MasteryLevel.Proficient]: '熟练',
  [MasteryLevel.Mastered]: '完全掌握',
}

export function adjustMastery(afterCorrect: boolean, current: MasteryLevel): MasteryLevel {
  const delta = afterCorrect ? 1 : -2
  const raw = Math.max(0, Math.min(5, current + delta))
  return raw as MasteryLevel
}

export interface MemoryScore {
  correctCount: number
  wrongCount: number
}

export function forgettingRate(memory: MemoryScore): number {
  const total = memory.correctCount + memory.wrongCount
  if (total <= 0) return 0
  return memory.wrongCount / total
}

export function recordMemory(memory: MemoryScore, correct: boolean): MemoryScore {
  return {
    correctCount: memory.correctCount + (correct ? 1 : 0),
    wrongCount: memory.wrongCount + (correct ? 0 : 1),
  }
}

export const ZERO_MEMORY: MemoryScore = { correctCount: 0, wrongCount: 0 }

export enum ReviewPool {
  Mastered = 'mastered',
  Review = 'review',
  Intensive = 'intensive',
}

export interface HanziWithProgress {
  character: HanziCharacter
  mastery: MasteryLevel
  memory: MemoryScore
  nextReviewAt: number | null
  intervalStep: number
  inIntensiveReview: boolean
}

export function reviewPool(item: HanziWithProgress): ReviewPool {
  if (item.mastery === MasteryLevel.Mastered && !item.inIntensiveReview) return ReviewPool.Mastered
  if (item.inIntensiveReview || item.mastery <= MasteryLevel.Familiar) return ReviewPool.Intensive
  return ReviewPool.Review
}

export enum StudyMode {
  Simple = 'simple',
  Standard = 'standard',
  Advanced = 'advanced',
}

export enum PinyinAgeMode {
  Young = 'young',
  Advanced = 'advanced',
}

export const STUDY_MODE_NAMES: Record<StudyMode, string> = {
  [StudyMode.Simple]: '简单模式',
  [StudyMode.Standard]: '标准模式',
  [StudyMode.Advanced]: '进阶模式',
}

export function newCharactersPerDay(mode: StudyMode): number {
  switch (mode) {
    case StudyMode.Simple: return 3
    case StudyMode.Standard: return 5
    case StudyMode.Advanced: return 10
  }
}

export const REVIEW_CHARACTERS_PER_DAY = 10
export const RANDOM_CHECK_PER_DAY = 5

export enum QuizType {
  Recognize = 'recognize',
  ListenPick = 'listenPick',
  SentenceFill = 'sentenceFill',
}

export const QUIZ_TYPE_TITLES: Record<QuizType, string> = {
  [QuizType.Recognize]: '认字',
  [QuizType.ListenPick]: '听音选字',
  [QuizType.SentenceFill]: '例句填空',
}

export const ALL_QUIZ_TYPES = [QuizType.Recognize, QuizType.ListenPick, QuizType.SentenceFill]

export function quizTypesForMode(mode: StudyMode): QuizType[] {
  if (mode === StudyMode.Simple) return [QuizType.Recognize, QuizType.SentenceFill]
  return ALL_QUIZ_TYPES
}

export interface QuizQuestion {
  id: string
  type: QuizType
  target: HanziCharacter
  prompt: string
  options: string[]
  correctIndex: number
  sentenceTemplate?: string
}

export interface DailyTaskPlan {
  newCharacters: HanziCharacter[]
  reviewCharacters: HanziCharacter[]
  randomCheckCharacters: HanziCharacter[]
}

export function planTotalCount(plan: DailyTaskPlan): number {
  return plan.newCharacters.length + plan.reviewCharacters.length + plan.randomCheckCharacters.length
}

export interface LearnSession {
  id: string
  questions: QuizQuestion[]
  learnCharacters: HanziCharacter[]
  currentLearnIndex: number
}

export interface MasteryBadge {
  threshold: number
  emoji: string
  title: string
}

export const MASTERY_BADGES: MasteryBadge[] = [
  { threshold: 50, emoji: '🌱', title: '识字小苗' },
  { threshold: 100, emoji: '🌿', title: '阅读新手' },
  { threshold: 300, emoji: '🌳', title: '阅读达人' },
  { threshold: 500, emoji: '📚', title: '阅读小博士' },
  { threshold: 1000, emoji: '🏆', title: '汉字大师' },
]

export interface IslandTheme {
  id: string
  name: string
  starCost: number
  emoji: string
}

export const ISLAND_CATALOG: IslandTheme[] = [
  { id: 'zoo', name: '动物园', starCost: 20, emoji: '🦁' },
  { id: 'ocean', name: '海底世界', starCost: 40, emoji: '🐠' },
  { id: 'dino', name: '恐龙乐园', starCost: 60, emoji: '🦕' },
  { id: 'space', name: '宇宙基地', starCost: 100, emoji: '🚀' },
]

export interface DailyLearningGoal {
  targetCount: number
  followStudyMode: boolean
}

export const DAILY_GOAL_MIN = 5
export const DAILY_GOAL_MAX = 50
export const DAILY_GOAL_STEP = 5

export const DAILY_GOAL_PRESETS = [
  { label: '轻松', value: 10 },
  { label: '标准', value: 20 },
  { label: '挑战', value: 30 },
]

export function recommendedDailyGoal(mode: StudyMode): number {
  return newCharactersPerDay(mode) + REVIEW_CHARACTERS_PER_DAY + RANDOM_CHECK_PER_DAY
}

export function clampDailyGoal(goal: DailyLearningGoal): DailyLearningGoal {
  return {
    ...goal,
    targetCount: Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, goal.targetCount)),
  }
}

export interface TodayLearningProgress {
  goal: number
  charactersStudied: number
  questionsAnswered: number
  correctCount: number
  newMasteredCount: number
}

export function todayProgressRatio(p: TodayLearningProgress): number {
  if (p.goal <= 0) return 0
  return Math.min(1, p.charactersStudied / p.goal)
}

export interface DailyStudySnapshot {
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

export interface StudyTrendChartData {
  dailyVolume: DailyStudySnapshot[]
  masteredGrowth: DailyStudySnapshot[]
  forgettingTrend: DailyStudySnapshot[]
}

export interface ParentDashboardStats {
  totalLearned: number
  trulyMastered: number
  inReview: number
  easyToForget: number
  weeklyNewMastered: HanziCharacter[]
  weeklyMasteredCount: number
}

export interface LearnedTabStats {
  mastered: number
  inProgress: number
  intensive: number
}

export enum LearnedListFilter {
  All = 'all',
  Mastered = 'mastered',
  InProgress = 'inProgress',
  Intensive = 'intensive',
}

export const LEARNED_FILTER_TITLES: Record<LearnedListFilter, string> = {
  [LearnedListFilter.All]: '全部',
  [LearnedListFilter.Mastered]: '学会的',
  [LearnedListFilter.InProgress]: '还在练',
  [LearnedListFilter.Intensive]: '要多练',
}

export interface CharacterProgressEntity {
  characterId: string
  masteryRaw: number
  correctCount: number
  wrongCount: number
  nextReviewAt: number | null
  intervalStep: number
  inIntensiveReview: boolean
  lastStudiedAt?: number | null
}

export interface UserProfileEntity {
  starCount: number
  studyModeRaw: string
  unlockedIslandIds: string[]
  weeklyMasteredIds: string[]
  lastDailyTaskDate?: number | null
  dailyLearningGoal: number
  followStudyModeGoal: boolean
  pinyinBreakdownEnabled?: boolean
  pinyinAgeModeRaw?: string
  homeWelcomeSpeechEnabled?: boolean
}

export function hasDecomposition(char: HanziCharacter): boolean {
  return !!(char.decomposeHint && char.decomposeHint.length > 0)
}

export function hasEvolution(char: HanziCharacter): boolean {
  return !!(char.evolutionHint && char.evolutionHint.length > 0)
}

export function showsComponentBreakdown(char: HanziCharacter): boolean {
  return !!(char.components && char.components.length > 0)
}

export function showsCompositionSection(char: HanziCharacter): boolean {
  return hasDecomposition(char) || showsComponentBreakdown(char)
}
