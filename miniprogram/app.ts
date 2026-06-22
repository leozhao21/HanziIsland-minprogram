import { getStore } from './store/appStore'
import { getSpeechService } from './services/speechService'

App<IAppOption>({
  globalData: {
    storeReady: false,
    speechReady: false,
    homeWelcomeSpeechPlayed: false,
  },

  onLaunch() {
    const speech = getSpeechService()
    this.globalData.speechReady = speech.isAvailable

    getStore().load().then(() => {
      this.globalData.storeReady = true
    })
  },
})
