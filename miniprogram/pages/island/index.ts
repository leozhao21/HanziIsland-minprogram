import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { ISLAND_CATALOG } from '../../domain/models'
import { setTabBarIndex } from '../../utils/pageHelper'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    starCount: 0,
    islands: [] as Array<{
      id: string
      name: string
      starCost: number
      emoji: string
      unlocked: boolean
      canUnlock: boolean
    }>,
    message: '',
  },

  onLoad() {
    unsubscribe = getStore().subscribe(() => this.refresh())
    this.refresh()
  },

  onShow() {
    setTabBarIndex(this, 2)
    this.refresh()
    getSpeechService().speak('这里是星星岛！攒够星星就能解锁新岛屿。')
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
  },

  refresh() {
    const store = getStore()
    this.setData({
      starCount: store.starCount,
      islands: ISLAND_CATALOG.map((island) => ({
        ...island,
        unlocked: store.unlockedIslands.includes(island.id),
        canUnlock: store.starCount >= island.starCost && !store.unlockedIslands.includes(island.id),
      })),
    })
  },

  onUnlock(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const store = getStore()
    const island = ISLAND_CATALOG.find((i) => i.id === id)
    if (!island) return
    const ok = store.unlockIsland(island)
    if (ok) {
      this.setData({ message: `解锁成功：${island.name}！` })
      getSpeechService().speak(`太棒了！解锁了${island.name}！`)
    } else {
      this.setData({ message: '星星还不够哦，继续学习吧！' })
      getSpeechService().speak('星星还不够哦，继续学习吧！')
    }
    this.refresh()
  },

  onGoAchievement() {
    wx.navigateTo({ url: '/pages/achievement/index' })
  },
})
