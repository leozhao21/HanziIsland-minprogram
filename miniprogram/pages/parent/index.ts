import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import {
  DAILY_GOAL_PRESETS,
  DailyTaskPlan,
  PinyinAgeMode,
  StudyMode,
} from '../../domain/models'
import { todayProgressPercent } from '../../utils/storeView'
import { PINYIN_AGE_MODE_OPTIONS } from '../../utils/pinyinBreakdown'

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
    speechLangIndex: 0,
    speechLangOptions: [
      { id: 'zh_CN', label: '普通话' },
      { id: 'en_US', label: '英语' },
    ],
    speechEnabled: true,
    speechAvailable: false,
    homeWelcomeSpeechEnabled: true,
    pinyinBreakdownEnabled: true,
    pinyinAgeMode: PinyinAgeMode.Young,
    pinyinAgeIndex: 0,
    pinyinAgeOptions: PINYIN_AGE_MODE_OPTIONS,
    cloudLoggedIn: false,
    cloudOpenIdShort: '',
    cloudSyncStatus: '未开启',
    lastCloudSyncText: '',
    cloudBusy: false,
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

  formatSyncTime(ms: number | null): string {
    if (!ms) return ''
    const d = new Date(ms)
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

    const cloudUser = store.cloudUser
    const openid = cloudUser?.openid || ''

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
      speechLangIndex: getSpeechService().selectedVoiceLang === 'en_US' ? 1 : 0,
      speechAvailable: getSpeechService().isAvailable,
      speechEnabled: getSpeechService().isEnabled(),
      homeWelcomeSpeechEnabled: store.homeWelcomeSpeechEnabled,
      pinyinBreakdownEnabled: store.pinyinBreakdownEnabled,
      pinyinAgeMode: store.pinyinAgeMode,
      pinyinAgeIndex: store.pinyinAgeMode === PinyinAgeMode.Advanced ? 1 : 0,
      cloudLoggedIn: !!cloudUser,
      cloudOpenIdShort: openid ? `${openid.slice(0, 6)}…${openid.slice(-4)}` : '',
      cloudSyncStatus: store.cloudSyncStatus,
      lastCloudSyncText: this.formatSyncTime(store.lastCloudSyncAt),
    })
  },

  async onCloudLogin() {
    if (this.data.cloudBusy) return
    this.setData({ cloudBusy: true })
    try {
      await getStore().loginAndSync()
      wx.showToast({ title: '同步已开启', icon: 'success' })
      this.refresh()
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '开启失败',
        icon: 'none',
      })
      this.refresh()
    } finally {
      this.setData({ cloudBusy: false })
    }
  },

  async onCloudSync() {
    if (this.data.cloudBusy) return
    this.setData({ cloudBusy: true })
    try {
      await getStore().syncWithCloud()
      wx.showToast({ title: '同步完成', icon: 'success' })
      this.refresh()
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '同步失败',
        icon: 'none',
      })
      this.refresh()
    } finally {
      this.setData({ cloudBusy: false })
    }
  },

  async onCloudRestore() {
    if (this.data.cloudBusy) return
    this.setData({ cloudBusy: true })
    try {
      const result = await getStore().restoreFromCloud()
      wx.showToast({
        title: result.progressCount > 0 ? `已恢复${result.progressCount}字` : '云端暂无学习记录',
        icon: result.progressCount > 0 ? 'success' : 'none',
      })
      if (result.progressCount > 0) {
        this.setData({ parentTab: 2 })
        getStore().reloadStudyTrend()
      }
      this.refresh()
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '恢复失败',
        icon: 'none',
      })
      this.refresh()
    } finally {
      this.setData({ cloudBusy: false })
    }
  },

  onCloudLogout() {
    getStore().logoutCloud()
    this.refresh()
    wx.showToast({ title: '已关闭同步', icon: 'none' })
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
    getSpeechService().unlockFromUserGesture()
    getSpeechService().previewVoice()
  },

  onToggleSpeech(e: WechatMiniprogram.SwitchChange) {
    getSpeechService().setEnabled(e.detail.value)
    this.setData({ speechEnabled: e.detail.value })
  },

  onToggleHomeWelcomeSpeech(e: WechatMiniprogram.SwitchChange) {
    getStore().setHomeWelcomeSpeechEnabled(e.detail.value)
    this.refresh()
  },

  onSpeechLangChange(e: WechatMiniprogram.PickerChange) {
    const index = parseInt(e.detail.value as string, 10)
    const lang = index === 1 ? 'en_US' : 'zh_CN'
    getSpeechService().setVoiceLang(lang)
    this.setData({ speechLang: lang, speechLangIndex: index })
    getSpeechService().unlockFromUserGesture()
    getSpeechService().previewVoice()
  },

  onTogglePinyinBreakdown(e: WechatMiniprogram.SwitchChange) {
    getStore().setPinyinBreakdownEnabled(e.detail.value)
    this.refresh()
  },

  onPinyinAgeChange(e: WechatMiniprogram.PickerChange) {
    const index = parseInt(e.detail.value as string, 10)
    const mode = index === 1 ? PinyinAgeMode.Advanced : PinyinAgeMode.Young
    getStore().setPinyinAgeMode(mode)
    this.refresh()
  },
})
