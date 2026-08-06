import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { todayProgressPercent } from '../../utils/storeView'
import { setTabBarIndex } from '../../utils/pageHelper'
import { markSyncGuidePrompted, shouldPromptSyncGuide } from '../../services/syncGuideService'
import { getAddToFavorites, getShareAppMessage, getShareTimeline } from '../../utils/share'

const HOME_WELCOME_TEXT = '你好！欢迎来到汉字奇遇岛。点下面的大按钮，开始学汉字吧！'

let unsubscribe: (() => void) | null = null

function maybePlayHomeWelcomeSpeech(): void {
  const app = getApp<IAppOption>()
  if (app.globalData.homeWelcomeSpeechPlayed) return

  const store = getStore()
  if (!store.homeWelcomeSpeechEnabled) return

  const speech = getSpeechService()
  if (!speech.isEnabled()) return

  app.globalData.homeWelcomeSpeechPlayed = true
  speech.speak(HOME_WELCOME_TEXT)
}

Page({
  data: {
    starCount: 0,
    progressPercent: 0,
    studiedCount: 0,
    isGoalMet: false,
    hasIntensiveReview: false,
    canStart: false,
    showSyncGuide: false,
    syncGuideBusy: false,
  },

  onLoad() {
    const store = getStore()
    unsubscribe = store.subscribe(() => this.refresh())
    this.refresh()
  },

  onShow() {
    setTabBarIndex(this, 0)
    getStore().reloadTodayProgress()
    this.refresh()
    maybePlayHomeWelcomeSpeech()
    this.maybeShowSyncGuide()
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
    getSpeechService().stop()
  },

  /** 转发给朋友 */
  onShareAppMessage() {
    return getShareAppMessage()
  },

  /** 分享到朋友圈 */
  onShareTimeline() {
    return getShareTimeline()
  },

  /** 收藏到「我」- 小程序 */
  onAddToFavorites() {
    return getAddToFavorites()
  },

  refresh() {
    const store = getStore()
    const tp = store.todayProgress
    this.setData({
      starCount: store.starCount,
      progressPercent: todayProgressPercent(tp.charactersStudied, tp.goal),
      studiedCount: tp.charactersStudied,
      isGoalMet: tp.charactersStudied >= tp.goal,
      hasIntensiveReview: store.intensiveReviewCharacters.length > 0,
      canStart: !!(store.dailyPlan && store.dailyPlan.newCharacters.length + store.dailyPlan.reviewCharacters.length + store.dailyPlan.randomCheckCharacters.length > 0),
    })
  },

  maybeShowSyncGuide() {
    if (this.data.showSyncGuide) return
    const store = getStore()
    const tp = store.todayProgress
    if (!shouldPromptSyncGuide({
      isLoaded: store.isLoaded,
      charactersStudied: tp.charactersStudied,
      goal: tp.goal,
    })) {
      return
    }
    markSyncGuidePrompted()
    this.setData({ showSyncGuide: true })
  },

  onStartLearn() {
    if (!this.data.canStart) return
    const store = getStore()
    getSpeechService().unlockFromUserGesture()
    const session = store.makeDailyLearnSession()
    if (!session) {
      wx.showToast({ title: '今日任务已完成', icon: 'none' })
      return
    }
    getSpeechService().stop()
    store.setPendingSession(session)
    wx.navigateTo({ url: '/pages/quiz/index' })
  },

  onRetryWrong() {
    const store = getStore()
    getSpeechService().unlockFromUserGesture()
    const session = store.makeIntensiveReviewSession()
    if (!session) {
      wx.showToast({ title: '暂时无法生成练习题', icon: 'none' })
      return
    }
    getSpeechService().stop()
    store.setPendingSession(session)
    wx.navigateTo({ url: '/pages/quiz/index' })
  },

  onOpenParent() {
    wx.navigateTo({ url: '/pages/parent/index' })
  },

  onDismissSyncGuide() {
    this.setData({ showSyncGuide: false })
  },

  preventMove() {},

  async onEnableSyncFromGuide() {
    if (this.data.syncGuideBusy) return
    this.setData({ syncGuideBusy: true })
    try {
      await getStore().loginAndSync()
      this.setData({ showSyncGuide: false })
      wx.showToast({ title: '同步已开启', icon: 'success' })
      this.refresh()
    } catch (err) {
      wx.showToast({
        title: err instanceof Error ? err.message : '开启失败',
        icon: 'none',
      })
    } finally {
      this.setData({ syncGuideBusy: false })
    }
  },
})
