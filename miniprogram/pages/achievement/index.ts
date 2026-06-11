import { getStore } from '../../store/appStore'
import { MASTERY_BADGES, MasteryLevel } from '../../domain/models'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    starCount: 0,
    masteredCount: 0,
    badges: [] as Array<{ threshold: number; emoji: string; title: string; earned: boolean }>,
    levels: [] as Array<{ level: number; mastered: number; total: number; percent: number }>,
  },

  onLoad() {
    unsubscribe = getStore().subscribe(() => this.refresh())
    this.refresh()
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
  },

  refresh() {
    const store = getStore()
    const badges = MASTERY_BADGES.map((b) => ({
      ...b,
      earned: store.masteredCount >= b.threshold,
    }))
    const levels = [1, 2, 3, 4].map((level) => {
      const total = store.catalog.filter((c) => c.level === level).length
      const mastered = store.catalog.filter(
        (c) => c.level === level && store.masteryFor(c.id) >= MasteryLevel.Mastered,
      ).length
      return {
        level,
        mastered,
        total,
        percent: total > 0 ? Math.round((mastered / total) * 100) : 0,
      }
    })
    this.setData({
      starCount: store.starCount,
      masteredCount: store.masteredCount,
      badges,
      levels,
    })
  },
})
