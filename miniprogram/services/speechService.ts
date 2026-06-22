import { HanziCharacter, PinyinAgeMode } from '../domain/models'
import { parsePinyinBreakdown } from '../utils/pinyinBreakdown'
import { buildPinyinBreakdownSpeech } from '../utils/pinyinSpeech'
import { getStorage, setStorage } from '../data/storage'
import {
  getWechatSiLoadError,
  isWechatSiLoaded,
  SPEECH_LANG_OPTIONS,
  splitTextForTTS,
  textToSpeech,
} from './wechatSiPlugin'

const VOICE_KEY = 'speechVoiceLang'
const ENABLED_KEY = 'speechEnabled'

interface QueuedItem {
  text: string
  pauseAfter: number
}

class SpeechService {
  private queue: QueuedItem[]
  private audio: WechatMiniprogram.InnerAudioContext | null
  private enabled: boolean
  private sessionId: number
  private pendingPause: number

  constructor() {
    this.queue = []
    this.audio = null
    this.enabled = getStorage(ENABLED_KEY, true)
    this.sessionId = 0
    this.pendingPause = 0
    this.initAudio()
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({ obeyMuteSwitch: false })
    }
  }

  private initAudio(): void {
    if (this.audio) {
      this.audio.destroy()
    }
    this.audio = wx.createInnerAudioContext()
    this.audio.obeyMuteSwitch = false
    this.audio.onEnded(() => this.onAudioEnded())
    this.audio.onError(() => this.onAudioEnded())
  }

  unlockFromUserGesture(): void {
    this.initAudio()
  }

  get isAvailable(): boolean {
    return isWechatSiLoaded()
  }

  get loadErrorMessage(): string {
    return getWechatSiLoadError() || '请在公众平台添加「微信同声传译」插件'
  }

  get selectedVoiceLang(): string {
    return getStorage(VOICE_KEY, 'zh_CN')
  }

  get langOptions(): typeof SPEECH_LANG_OPTIONS {
    return SPEECH_LANG_OPTIONS
  }

  setVoiceLang(lang: string): void {
    setStorage(VOICE_KEY, lang)
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    setStorage(ENABLED_KEY, enabled)
    if (!enabled) this.stop()
  }

  stop(): void {
    this.sessionId += 1
    this.queue = []
    this.pendingPause = 0
    if (this.audio) {
      this.audio.stop()
    }
  }

  speak(text: string): void {
    this.startSession(this.textToItems(text))
  }

  speakLearnCharacterAuto(character: HanziCharacter): void {
    this.startSession(this.characterTwice(character.character))
  }

  speakCharacterWithPinyin(character: HanziCharacter): void {
    const items = this.characterTwice(character.character, 100)
    items.push.apply(items, this.textToItems(character.sentence))
    this.startSession(items)
  }

  speakSentence(character: HanziCharacter): void {
    this.startSession(this.textToItems(character.sentence))
  }

  speakPinyinBreakdown(character: HanziCharacter, ageMode: PinyinAgeMode): void {
    const breakdown = parsePinyinBreakdown(character.pinyin)
    if (!breakdown) return

    const mode = ageMode === PinyinAgeMode.Advanced ? 'advanced' : 'young'
    const lines = buildPinyinBreakdownSpeech(character, breakdown, mode)
    const items: QueuedItem[] = []
    lines.forEach((line, index) => {
      items.push.apply(items, this.textToItems(line, index < lines.length - 1 ? 220 : 0))
    })
    this.startSession(items)
  }

  speakComposition(character: HanziCharacter): void {
    const hint = character.decomposeHint ? character.decomposeHint.trim() : ''
    const components = character.components || []
    if (!hint && components.length === 0) return

    const items: QueuedItem[] = []
    if (components.length >= 2) {
      components.forEach((part, index) => {
        items.push.apply(items, this.textToItems(part, index < components.length - 1 ? 180 : 220))
      })
      const partsText = components.map((p) => '「' + p + '」').join('和')
      items.push.apply(items, this.textToItems(
        '组成' + partsText + '，就是「' + character.character + '」。',
        hint ? 120 : 0,
      ))
    } else if (components[0]) {
      items.push.apply(items, this.textToItems(components[0], 120))
    }
    if (hint) {
      items.push.apply(items, this.textToItems(hint))
    }
    this.startSession(items)
  }

  speakEvolution(character: HanziCharacter): void {
    const hint = character.evolutionHint ? character.evolutionHint.trim() : ''
    if (!hint) return

    const items: QueuedItem[] = []
    if (character.evolutionType) {
      items.push.apply(items, this.textToItems(
        '「' + character.character + '」是' + character.evolutionType + '字。',
        120,
      ))
    } else {
      items.push.apply(items, this.textToItems(
        '一起来听「' + character.character + '」的演变故事。',
        120,
      ))
    }
    items.push.apply(items, this.textToItems(hint))
    this.startSession(items)
  }

  speakQuizListenChallenge(character: HanziCharacter): void {
    const items: QueuedItem[] = []
    items.push.apply(items, this.textToItems('听一听，选出你听到的字。', 350))
    items.push.apply(items, this.characterTwice(character.character))
    this.startSession(items)
  }

  speakQuizSentence(character: HanziCharacter): void {
    this.speakSentence(character)
  }

  speakCharacter(character: HanziCharacter): void {
    this.startSession(this.characterTwice(character.character))
  }

  previewVoice(): boolean {
    if (!isWechatSiLoaded()) {
      wx.showToast({
        title: this.loadErrorMessage,
        icon: 'none',
        duration: 2800,
      })
      return false
    }
    this.speak('你好，我是识字岛，一起来学汉字吧！')
    return true
  }

  private textToItems(text: string, pauseAfter = 0): QueuedItem[] {
    const parts = splitTextForTTS(text)
    return parts.map((part, index) => ({
      text: part,
      pauseAfter: index === parts.length - 1 ? pauseAfter : 120,
    }))
  }

  private characterTwice(glyph: string, pauseBeforeNext = 0): QueuedItem[] {
    return [
      { text: glyph, pauseAfter: 100 },
      { text: glyph, pauseAfter: pauseBeforeNext },
    ]
  }

  private startSession(utterances: QueuedItem[]): void {
    if (!this.enabled) return
    if (!isWechatSiLoaded()) return

    const valid = utterances.filter((u) => u.text.trim().length > 0)
    if (valid.length === 0) return

    this.stop()
    this.queue = valid
    this.runSession(this.sessionId)
  }

  private runSession(sessionId: number): void {
    if (sessionId !== this.sessionId) return
    if (this.queue.length === 0) return

    const item = this.queue.shift()
    if (!item) return

    textToSpeech(this.selectedVoiceLang, item.text)
      .then((filename) => {
        if (sessionId !== this.sessionId) return
        if (!this.audio) return
        this.pendingPause = item.pauseAfter
        this.audio.src = filename
        this.audio.play()
      })
      .catch(() => {
        if (sessionId !== this.sessionId) return
        this.advanceAfterPause(sessionId, item.pauseAfter)
      })
  }

  private onAudioEnded(): void {
    const sessionId = this.sessionId
    const pause = this.pendingPause
    this.pendingPause = 0
    this.advanceAfterPause(sessionId, pause)
  }

  private advanceAfterPause(sessionId: number, pause: number): void {
    if (sessionId !== this.sessionId) return
    if (pause > 0) {
      setTimeout(() => {
        if (sessionId === this.sessionId) this.runSession(sessionId)
      }, pause)
    } else {
      this.runSession(sessionId)
    }
  }
}

let speechInstance: SpeechService | null = null

export function getSpeechService(): SpeechService {
  if (!speechInstance) speechInstance = new SpeechService()
  return speechInstance
}

export { WECHAT_SI_PLUGIN } from './wechatSiPlugin'
