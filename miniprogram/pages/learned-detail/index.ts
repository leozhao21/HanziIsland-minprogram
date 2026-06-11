import { getStore } from '../../store/appStore'
import { getSpeechService } from '../../services/speechService'
import { HanziCharacter, MASTERY_TITLES, MasteryLevel } from '../../domain/models'

let unsubscribe: (() => void) | null = null

Page({
  data: {
    characterId: '',
    character: null as HanziCharacter | null,
    masteryTitle: '',
    masteryPercent: 0,
    correctCount: 0,
    wrongCount: 0,
    nextReviewText: '',
    inIntensiveReview: false,
  },

  onLoad(query: Record<string, string | undefined>) {
    const id = query.id || ''
    this.setData({ characterId: id })
    unsubscribe = getStore().subscribe(() => this.refresh())
    this.refresh()
  },

  onUnload() {
    if (unsubscribe) unsubscribe()
  },

  refresh() {
    const store = getStore()
    const item = store.progressFor(this.data.characterId)
    if (!item) return
    this.setData({
      character: item.character,
      masteryTitle: MASTERY_TITLES[item.mastery],
      masteryPercent: Math.round((item.mastery / 5) * 100),
      correctCount: item.memory.correctCount,
      wrongCount: item.memory.wrongCount,
      nextReviewText: item.nextReviewAt ? this.formatRelative(item.nextReviewAt) : '',
      inIntensiveReview: item.inIntensiveReview,
    })
  },

  formatRelative(ms: number): string {
    const diff = ms - Date.now()
    const days = Math.ceil(diff / 86400000)
    if (days <= 0) return '今天'
    if (days === 1) return '明天'
    if (days <= 7) return `${days} 天后`
    const d = new Date(ms)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  },

  onRetest() {
    const store = getStore()
    const item = store.progressFor(this.data.characterId)
    if (!item) return
    getSpeechService().stop()
    store.setPendingSession(store.makeCharacterQuizSession(item.character))
    wx.navigateTo({ url: '/pages/quiz/index' })
  },

  onSpeakCharacter() {
    const char = this.data.character
    if (char) getSpeechService().speakCharacterWithPinyin(char)
  },

  onSpeakSentence() {
    const char = this.data.character
    if (char) getSpeechService().speakSentence(char)
  },

  onSpeakComposition() {
    const char = this.data.character
    if (char) getSpeechService().speakComposition(char)
  },

  onSpeakEvolution() {
    const char = this.data.character
    if (char) getSpeechService().speakEvolution(char)
  },
})
