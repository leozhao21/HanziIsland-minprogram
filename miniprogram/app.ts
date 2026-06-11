import { getStore } from './store/appStore'

App<IAppOption>({
  globalData: {
    storeReady: false,
  },

  onLaunch() {
    getStore().load().then(() => {
      this.globalData.storeReady = true
    })
  },
})
