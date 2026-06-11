import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import {
  DAILY_GOAL_PRESETS,
  DailyTaskPlan,
  StudyMode,
} from '../../domain/models'
import { todayProgressPercent } from '../../utils/storeView'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    gatePassed: false,
    gateLeft: 0,
    gateRight: 0,
    gateAnswer: '',
    gateWrong: false,
    parentTab: 0,
    studyMode: StudyMode.Standard,
    studyModeIndex: 1,
    studyModes: [
      { key: StudyMode.Simple, label: '简单模式（3新字）' },
      { key: StudyMode.Standard, label: '标准模式（5新字）' },
      { key: StudyMode.Advanced, label: '进阶模式（10新字）' },
    ],
    dailyGoal: { targetCount: 20, followStudyMode: true },
    todayProgress: { goal: 20, charactersStudied: 0, questionsAnswered: 0, correctCount: 0, newMasteredCount: 0 },
    progressPercent: 0,
    isGoalMet: false,
    recommendedGoal: 20,
    goalPresets: DAILY_GOAL_PRESETS,
    dailyPlan: null as DailyTaskPlan | null,
    planNewChars: '',
    planReviewChars: '',
    planRandomChars: '',
    planNewCount: 0,
    planReviewCount: 0,
    planRandomCount: 0,
    stats: { totalLearned: 0, trulyMastered: 0, inReview: 0, easyToForget: 0, weeklyMasteredCount: 0 },
    weeklyChars: [] as string[],
    intensiveList: [] as Array<{ character: string; sentence: string; rate: string }>,
    trendData: [] as Array<{ label: string; questions: number; studied: number; mastered: number; forgetting: number }>,
    speechLang: 'zh_CN',
    speechEnabled: true,
    speechAvailable: false,
  },

  onLoad() {
    this.resetGate()
    unsubscribe = getStore().subscribe(() => this.refresh())
    this.refresh()
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
  },

  resetGate() {
    this.setData({
      gatePassed: false,
      gateLeft: Math.floor(Math.random() * 7) + 3,
      gateRight: Math.floor(Math.random() * 7) + 2,
      gateAnswer: '',
      gateWrong: false,
    })
  },

  refresh() {
    const store = getStore()
    const tp = store.todayProgress
    const plan = store.dailyPlan
    const stats = store.parentDashboard
    const trend = store.studyTrend.dailyVolume.map((s) => ({
      label: `${new Date(s.dayStart).getMonth() + 1}/${new Date(s.dayStart).getDate()}`,
      questions: s.questionsAnswered,
      studied: s.charactersStudied,
      mastered: s.cumulativeMastered,
      forgetting: Math.round(s.averageForgettingRate * 100),
    }))

    const intensive = Object.values(store.progressMap)
      .filter((p) => p.inIntensiveReview)
      .sort((a, b) => {
        const aT = a.memory.correctCount + a.memory.wrongCount
        const bT = b.memory.correctCount + b.memory.wrongCount
        const aR = aT > 0 ? a.memory.wrongCount / aT : 0
        const bR = bT > 0 ? b.memory.wrongCount / bT : 0
        return bR - aR
      })
      .map((p) => ({
        character: p.character.character,
        sentence: p.character.sentence,
        rate: `${Math.round((p.memory.wrongCount / Math.max(1, p.memory.correctCount + p.memory.wrongCount)) * 100)}%`,
      }))

    this.setData({
      studyMode: store.studyMode,
      studyModeIndex: store.studyMode === StudyMode.Simple ? 0 : store.studyMode === StudyMode.Standard ? 1 : 2,
      dailyGoal: store.dailyLearningGoal,
      todayProgress: tp,
      progressPercent: todayProgressPercent(tp.charactersStudied, tp.goal),
      isGoalMet: tp.charactersStudied >= tp.goal,
      recommendedGoal: store.recommendedDailyGoal,
      dailyPlan: plan,
      planNewChars: plan ? plan.newCharacters.map((c) => c.character).join(' ') : '暂无',
      planReviewChars: plan ? plan.reviewCharacters.map((c) => c.character).join(' ') : '暂无',
      planRandomChars: plan ? plan.randomCheckCharacters.map((c) => c.character).join(' ') : '暂无',
      planNewCount: plan ? plan.newCharacters.length : 0,
      planReviewCount: plan ? plan.reviewCharacters.length : 0,
      planRandomCount: plan ? plan.randomCheckCharacters.length : 0,
      stats,
      weeklyChars: stats.weeklyNewMastered.map((c) => c.character),
      intensiveList: intensive,
      trendData: trend,
      speechLang: getSpeechService().selectedVoiceLang,
      speechAvailable: getSpeechService().isAvailable,
    })
  },

  onGateInput(e: WechatMiniprogram.Input) {
    this.setData({ gateAnswer: e.detail.value, gateWrong: false })
  },

  onGateSubmit() {
    const sum = this.data.gateLeft + this.data.gateRight
    if (parseInt(this.data.gateAnswer, 10) === sum) {
      this.setData({ gatePassed: true })
    } else {
      this.setData({ gateWrong: true, gateAnswer: '' })
    }
  },

  onClose() {
    wx.navigateBack()
  },

  onTabChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({ parentTab: parseInt(e.currentTarget.dataset.tab as string, 10) })
    if (parseInt(e.currentTarget.dataset.tab as string, 10) === 2) {
      getStore().reloadStudyTrend()
      this.refresh()
    }
  },

  onModeChange(e: WechatMiniprogram.PickerChange) {
    const modes = [StudyMode.Simple, StudyMode.Standard, StudyMode.Advanced]
    getStore().updateStudyMode(modes[parseInt(e.detail.value as string, 10)])
    this.refresh()
  },

  onPresetGoal(e: WechatMiniprogram.TouchEvent) {
    const value = parseInt(String(e.currentTarget.dataset.value), 10)
    getStore().updateDailyLearningGoal(value)
    this.refresh()
  },

  onAdjustGoal(e: WechatMiniprogram.TouchEvent) {
    const delta = parseInt(e.currentTarget.dataset.delta as string, 10)
    const store = getStore()
    store.updateDailyLearningGoal(store.dailyLearningGoal.targetCount + delta)
    this.refresh()
  },

  onFollowModeChange(e: WechatMiniprogram.SwitchChange) {
    getStore().setFollowStudyModeGoal(e.detail.value)
    this.refresh()
  },

  onApplyRecommended() {
    getStore().applyRecommendedDailyGoal()
    this.refresh()
  },

  onPreviewVoice() {
    getSpeechService().previewVoice()
  },

  onToggleSpeech(e: WechatMiniprogram.SwitchChange) {
    getSpeechService().setEnabled(e.detail.value)
    this.setData({ speechEnabled: e.detail.value })
  },
})
