import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { todayProgressPercent } from '../../utils/storeView'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    starCount: 0,
    progressPercent: 0,
    studiedCount: 0,
    isGoalMet: false,
    hasIntensiveReview: false,
    canStart: false,
    speechEnabled: true,
  },

  onLoad() {
    const store = getStore()
    unsubscribe = store.subscribe(() => this.refresh())
    this.refresh()
  },

  onShow() {
    getStore().reloadTodayProgress()
    this.refresh()
    getSpeechService().speak('你好！欢迎来到识字岛。点下面的大按钮，开始学汉字吧！')
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
    getSpeechService().stop()
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

  onStartLearn() {
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
    if (!session) return
    getSpeechService().stop()
    store.setPendingSession(session)
    wx.navigateTo({ url: '/pages/quiz/index' })
  },

  onOpenParent() {
    wx.navigateTo({ url: '/pages/parent/index' })
  },
})
