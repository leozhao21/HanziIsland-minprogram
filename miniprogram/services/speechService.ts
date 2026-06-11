import { HanziCharacter } from '../domain/models'
import { getStorage, setStorage } from '../data/storage'

const VOICE_KEY = 'speechVoiceLang'

/** 微信同声传译插件 provider，需在公众平台授权后才可在 app.json 中声明 */
export const WECHAT_SI_PLUGIN = {
  name: 'WechatSI',
  version: '0.3.5',
  provider: 'wx069ba97219f66d99',
} as const

interface QueuedItem {
  text: string
  pauseAfter: number
}

class SpeechService {
  private queue: QueuedItem[] = []
  private audio: WechatMiniprogram.InnerAudioContext | null = null
  private enabled = true
  private pluginReady = false
  private wechatSI: Record<string, unknown> | null = null
  private pluginChecked = false

  constructor() {
    this.audio = wx.createInnerAudioContext()
    this.audio.onEnded(() => this.onUtteranceDone())
    this.audio.onError(() => this.onUtteranceDone())
  }

  /** 是否已授权并加载同声传译插件（未在 app.json 声明时恒为 false） */
  get isAvailable(): boolean {
    this.ensurePlugin()
    return this.pluginReady
  }

  get selectedVoiceLang(): string {
    return getStorage(VOICE_KEY, 'zh_CN')
  }

  setVoiceLang(lang: string): void {
    setStorage(VOICE_KEY, lang)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stop()
  }

  stop(): void {
    this.queue = []
    if (this.audio) this.audio.stop()
  }

  speak(text: string): void {
    const trimmed = text.trim()
    if (!trimmed || !this.enabled) return
    if (!this.ensurePlugin()) return
    this.startSession([{ text: trimmed, pauseAfter: 0 }])
  }

  speakLearnCharacterAuto(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    this.startSession(this.characterTwice(character.character))
  }

  speakCharacterWithPinyin(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    const items = this.characterTwice(character.character, 100)
    items.push({ text: character.sentence, pauseAfter: 0 })
    this.startSession(items)
  }

  speakSentence(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    const sentence = character.sentence.trim()
    if (!sentence) return
    this.startSession([{ text: sentence, pauseAfter: 0 }])
  }

  speakComposition(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    const hint = character.decomposeHint ? character.decomposeHint.trim() : ''
    const components = character.components || []
    if (!hint && components.length === 0) return

    const items: QueuedItem[] = []
    if (components.length >= 2) {
      components.forEach((part, index) => {
        items.push({ text: part, pauseAfter: index < components.length - 1 ? 180 : 220 })
      })
      const partsText = components.map((p) => `「${p}」`).join('和')
      items.push({
        text: `组成${partsText}，就是「${character.character}」。`,
        pauseAfter: hint ? 120 : 0,
      })
    } else if (components[0]) {
      items.push({ text: components[0], pauseAfter: 120 })
    }
    if (hint) items.push({ text: hint, pauseAfter: 0 })
    this.startSession(items)
  }

  speakEvolution(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    const hint = character.evolutionHint ? character.evolutionHint.trim() : ''
    if (!hint) return
    const items: QueuedItem[] = []
    if (character.evolutionType) {
      items.push({
        text: `「${character.character}」是${character.evolutionType}字。`,
        pauseAfter: 120,
      })
    } else {
      items.push({
        text: `一起来听「${character.character}」的演变故事。`,
        pauseAfter: 120,
      })
    }
    items.push({ text: hint, pauseAfter: 0 })
    this.startSession(items)
  }

  speakQuizListenChallenge(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    const items: QueuedItem[] = [
      { text: '听一听，选出你听到的字。', pauseAfter: 350 },
      ...this.characterTwice(character.character),
    ]
    this.startSession(items)
  }

  speakQuizSentence(character: HanziCharacter): void {
    this.speakSentence(character)
  }

  speakCharacter(character: HanziCharacter): void {
    if (!this.ensurePlugin()) return
    this.startSession(this.characterTwice(character.character))
  }

  previewVoice(): boolean {
    if (!this.ensurePlugin()) {
      wx.showToast({
        title: '朗读插件未授权，暂不可用',
        icon: 'none',
        duration: 2500,
      })
      return false
    }
    this.speak('你好，我是识字岛，一起来学汉字吧！')
    return true
  }

  private ensurePlugin(): boolean {
    if (this.pluginChecked) return this.pluginReady
    this.pluginChecked = true
    try {
      this.wechatSI = requirePlugin(WECHAT_SI_PLUGIN.name)
      this.pluginReady = !!this.wechatSI && typeof (this.wechatSI as { textToSpeech?: unknown }).textToSpeech === 'function'
    } catch {
      this.pluginReady = false
      this.wechatSI = null
    }
    return this.pluginReady
  }

  private characterTwice(glyph: string, pauseBeforeNext = 0): QueuedItem[] {
    return [
      { text: glyph, pauseAfter: 100 },
      { text: glyph, pauseAfter: pauseBeforeNext },
    ]
  }

  private startSession(utterances: QueuedItem[]): void {
    const valid = utterances.filter((u) => u.text.trim().length > 0)
    if (valid.length === 0 || !this.enabled || !this.pluginReady) return
    this.stop()
    this.queue = valid
    this.speakNext()
  }

  private speakNext(): void {
    if (this.queue.length === 0) return

    const item = this.queue.shift()!
    if (!this.wechatSI) {
      this.onUtteranceDone(item.pauseAfter)
      return
    }

    const si = this.wechatSI as {
      textToSpeech: (opts: {
        lang: string
        content: string
        success?: (res: { filename: string }) => void
        fail?: () => void
      }) => void
    }
    si.textToSpeech({
      lang: this.selectedVoiceLang,
      content: item.text,
      success: (res) => {
        if (!this.audio) return
        this.audio.src = res.filename
        this.audio.play()
        this.pendingPause = item.pauseAfter
      },
      fail: () => {
        this.onUtteranceDone(item.pauseAfter)
      },
    })
  }

  private pendingPause = 0

  private onUtteranceDone(fallbackPause = 0): void {
    const pause = this.pendingPause || fallbackPause
    this.pendingPause = 0
    if (pause > 0) {
      setTimeout(() => this.speakNext(), pause)
    } else {
      this.speakNext()
    }
  }
}

let speechInstance: SpeechService | null = null

export function getSpeechService(): SpeechService {
  if (!speechInstance) speechInstance = new SpeechService()
  return speechInstance
}
