import { getStore } from '../store/appStore'

export function bindStore(page: WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>): () => void {
  const store = getStore()
  return store.subscribe(() => {
    page.setData({ storeSnapshot: store.getSnapshot() })
  })
}

export function withStore<T extends Record<string, unknown>>(
  data: T,
): T & { storeSnapshot: Record<string, unknown> } {
  return { ...data, storeSnapshot: {} }
}

export function syncFromStore(page: WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>): void {
  const store = getStore()
  page.setData({
    starCount: store.starCount,
    todayProgress: store.todayProgress,
    dailyPlan: store.dailyPlan,
    hasIntensiveReview: store.intensiveReviewCharacters.length > 0,
    isGoalMet: store.todayProgress.charactersStudied >= store.todayProgress.goal,
    progressPercent: Math.round(
      (store.todayProgress.goal > 0
        ? Math.min(1, store.todayProgress.charactersStudied / store.todayProgress.goal)
        : 0) * 100,
    ),
  })
}
