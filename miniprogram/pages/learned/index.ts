import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { LearnedListFilter } from '../../domain/models'
import { learnedItemToView } from '../../utils/storeView'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    stats: { mastered: 0, inProgress: 0, intensive: 0 },
    filter: LearnedListFilter.All,
    filterOptions: [
      { key: LearnedListFilter.All, title: '全部' },
      { key: LearnedListFilter.Mastered, title: '学会的' },
      { key: LearnedListFilter.InProgress, title: '还在练' },
      { key: LearnedListFilter.Intensive, title: '要多练' },
    ],
    items: [] as ReturnType<typeof learnedItemToView>[],
    emptyMessage: '还没有测过的字',
    showEmptyHint: true,
  },

  onLoad() {
    unsubscribe = getStore().subscribe(() => this.refresh())
    this.refresh()
  },

  onShow() {
    this.refresh()
    getSpeechService().speak('这里是你学过的字，看看你学会了多少吧。')
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
  },

  refresh() {
    const store = getStore()
    const filter = this.data.filter as LearnedListFilter
    const items = store.filteredLearnedCharacters(filter).map(learnedItemToView)
    this.setData({
      stats: store.learnedTabStats,
      items,
      emptyMessage: this.getEmptyMessage(filter),
      showEmptyHint: filter === LearnedListFilter.All,
    })
  },

  getEmptyMessage(filter: LearnedListFilter): string {
    switch (filter) {
      case LearnedListFilter.All: return '还没有测过的字'
      case LearnedListFilter.Mastered: return '还没有完全掌握的字'
      case LearnedListFilter.InProgress: return '没有正在练习的字'
      case LearnedListFilter.Intensive: return '太棒了，没有要多练的字'
    }
  },

  onFilterTap(e: WechatMiniprogram.TouchEvent) {
    const filter = e.currentTarget.dataset.filter as LearnedListFilter
    this.setData({ filter }, () => this.refresh())
  },

  onStatTap(e: WechatMiniprogram.TouchEvent) {
    const filter = e.currentTarget.dataset.filter as LearnedListFilter
    this.setData({ filter }, () => this.refresh())
  },

  onItemTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    wx.navigateTo({ url: `/pages/learned-detail/index?id=${id}` })
  },
})
