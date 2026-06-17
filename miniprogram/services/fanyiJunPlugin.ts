/**
 * 腾讯「翻译君sdk」小程序插件
 * 文档: https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wxb1070eabc6f9107e
 *
 * 须在公众平台 → 设置 → 插件管理 中添加「翻译君sdk」
 */
export const FANYI_JUN_PLUGIN = {
  /** app.json plugins 中的自定义引用名 */
  name: 'FanyiJunSDK',
  version: '0.1.0',
  provider: 'wxb1070eabc6f9107e',
} as const

/** 官方限制：单次合成约 50 汉字，保守取 45 */
export const TTS_MAX_CHARS = 45

export const SPEECH_LANG_OPTIONS = [
  { id: 'zh_CN', label: '普通话' },
  { id: 'en_US', label: '英语' },
] as const

interface TtsResponse {
  filename?: string
  tempFilePath?: string
  filePath?: string
  url?: string
  retcode?: number
}

type PluginLike = Record<string, unknown>

let cachedPlugin: PluginLike | null = null
let loadAttempted = false
let loadError: string | null = null
let ttsMode: 'textToSpeech' | 'translate' | null = null

function extractAudioUrl(res: TtsResponse): string | null {
  return res.filename || res.tempFilePath || res.filePath || res.url || null
}

export function isFanyiJunLoaded(): boolean {
  return getFanyiJunPlugin() !== null
}

export function getFanyiJunLoadError(): string | null {
  if (!loadAttempted) getFanyiJunPlugin()
  return loadError
}

function detectTtsMode(plugin: PluginLike): 'textToSpeech' | 'translate' | null {
  if (typeof plugin.textToSpeech === 'function') return 'textToSpeech'
  if (typeof plugin.translate === 'function') return 'translate'
  return null
}

export function getFanyiJunPlugin(): PluginLike | null {
  if (loadAttempted) return cachedPlugin
  loadAttempted = true

  const candidates = [FANYI_JUN_PLUGIN.name, FANYI_JUN_PLUGIN.provider]
  for (let i = 0; i < candidates.length; i++) {
    try {
      const plugin = requirePlugin(candidates[i]) as PluginLike
      const mode = detectTtsMode(plugin)
      if (mode) {
        cachedPlugin = plugin
        ttsMode = mode
        loadError = null
        return cachedPlugin
      }
    } catch (e) {
      if (i === candidates.length - 1 && !loadError) {
        loadError = e instanceof Error ? e.message : '翻译君sdk 插件未加载'
      }
    }
  }

  cachedPlugin = null
  ttsMode = null
  if (!loadError) {
    loadError = '翻译君sdk 未提供 textToSpeech / translate 接口'
  }
  return null
}

export function splitTextForTTS(text: string, maxLen = TTS_MAX_CHARS): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxLen) return [trimmed]

  const chunks: string[] = []
  let remaining = trimmed
  const punct = ['。', '！', '？', '；', '，', '、', ' ']

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    let splitAt = -1
    for (let i = Math.min(maxLen, remaining.length) - 1; i >= Math.floor(maxLen * 0.4); i--) {
      if (punct.indexOf(remaining.charAt(i)) >= 0) {
        splitAt = i + 1
        break
      }
    }
    if (splitAt < 0) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt)
  }
  return chunks
}

function callTextToSpeech(plugin: PluginLike, lang: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fn = plugin.textToSpeech as (opts: Record<string, unknown>) => void
    fn({
      lang,
      tts: true,
      content,
      success: (res: TtsResponse) => {
        const url = extractAudioUrl(res)
        if (url) resolve(url)
        else reject(new Error('语音合成未返回音频地址'))
      },
      fail: (err: Record<string, unknown>) => {
        reject(err || new Error('textToSpeech 失败'))
      },
    })
  })
}

/** translate + tts，lfrom/lto 相同则仅做语音合成 */
function callTranslateTts(plugin: PluginLike, lang: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fn = plugin.translate as (opts: Record<string, unknown>) => void
    fn({
      lfrom: lang,
      lto: lang,
      content,
      tts: true,
      success: (res: TtsResponse & { result?: string }) => {
        const url = extractAudioUrl(res)
        if (url) resolve(url)
        else reject(new Error('translate 未返回音频地址'))
      },
      fail: (err: Record<string, unknown>) => {
        reject(err || new Error('translate 失败'))
      },
    })
  })
}

export function textToSpeech(lang: string, content: string): Promise<string> {
  const plugin = getFanyiJunPlugin()
  if (!plugin || !ttsMode) {
    return Promise.reject(new Error(loadError || '翻译君sdk 插件未授权'))
  }

  const piece = content.trim()
  if (!piece) return Promise.reject(new Error('朗读内容为空'))
  if (piece.length > TTS_MAX_CHARS) {
    return Promise.reject(new Error('单段文本超过插件长度限制'))
  }

  if (ttsMode === 'textToSpeech') {
    return callTextToSpeech(plugin, lang, piece)
  }
  return callTranslateTts(plugin, lang, piece)
}
