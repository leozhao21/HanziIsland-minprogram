import { getStore } from '../../store/appStore'

Page({
  data: {
    loadStatus: '正在启动…',
    loadError: '',
  },

  onLoad() {
    const store = getStore()
    const done = () => {
      if (store.isLoaded) {
        wx.switchTab({ url: '/pages/home/index' })
      } else {
        this.setData({
          loadError: store.loadError || '加载失败',
          loadStatus: store.loadStatus,
        })
      }
    }
    if (store.isLoaded) {
      done()
      return
    }
    store.load().then(done)
  },

  onRetry() {
    this.setData({ loadError: '', loadStatus: '正在重试…' })
    const store = getStore()
    const done = () => {
      if (store.isLoaded) {
        wx.switchTab({ url: '/pages/home/index' })
      } else {
        this.setData({
          loadError: store.loadError || '加载失败',
          loadStatus: store.loadStatus,
        })
      }
    }
    store.load().then(done)
  },
})
