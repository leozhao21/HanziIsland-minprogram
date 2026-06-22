Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/home/index',
        text: '玩',
        iconPath: '/assets/tab-play.png',
        selectedIconPath: '/assets/tab-play-active.png',
      },
      {
        pagePath: '/pages/learned/index',
        text: '已学',
        iconPath: '/assets/tab-learned.png',
        selectedIconPath: '/assets/tab-learned-active.png',
      },
      {
        pagePath: '/pages/island/index',
        text: '星星',
        iconPath: '/assets/tab-star.png',
        selectedIconPath: '/assets/tab-star-active.png',
      },
    ],
  },

  methods: {
    switchTab(e: WechatMiniprogram.TouchEvent) {
      const index = e.currentTarget.dataset.index as number
      const path = e.currentTarget.dataset.path as string
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    },
  },
})
