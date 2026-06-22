/**
 * 微信「同声传译」小程序插件
 * 文档: https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/extended/translator.html
 *
 * 须在公众平台 → 设置 → 插件管理 中添加「微信同声传译」
 */
export const WECHAT_SI_PLUGIN = {
  /** app.json plugins 中的自定义引用名 */
  name: 'WechatSI',
  version: '0.3.5',
  provider: 'wx069ba97219f66d99',
} as const

/** 官方限制：单次合成约 50 汉字，保守取 45 */
export const TTS_MAX_CHARS = 45

export const SPEECH_LANG_OPTIONS = [
  { id: 'zh_CN', label: '普通话' },
  { id: 'en_US', label: '英语' },
] as const

interface TtsResponse {
  retcode?: number
  filename?: string
  tempFilePath?: string
  filePath?: string
  url?: string
  msg?: string
}

type PluginLike = {
  textToSpeech?: (opts: Record<string, unknown>) => void
}

let cachedPlugin: PluginLike | null = null
let loadAttempted = false
let loadError: string | null = null

function extractAudioUrl(res: TtsResponse): string | null {
  return res.filename || res.tempFilePath || res.filePath || res.url || null
}

export function isWechatSiLoaded(): boolean {
  return getWechatSiPlugin() !== null
}

export function getWechatSiLoadError(): string | null {
  if (!loadAttempted) getWechatSiPlugin()
  return loadError
}

export function getWechatSiPlugin(): PluginLike | null {
  if (loadAttempted) return cachedPlugin
  loadAttempted = true

  const candidates = [WECHAT_SI_PLUGIN.name, WECHAT_SI_PLUGIN.provider]
  for (let i = 0; i < candidates.length; i++) {
    try {
      const plugin = requirePlugin(candidates[i]) as PluginLike
      if (typeof plugin.textToSpeech === 'function') {
        cachedPlugin = plugin
        loadError = null
        return cachedPlugin
      }
    } catch (e) {
      if (i === candidates.length - 1 && !loadError) {
        loadError = e instanceof Error ? e.message : '微信同声传译插件未加载'
      }
    }
  }

  cachedPlugin = null
  if (!loadError) {
    loadError = '微信同声传译未提供 textToSpeech 接口'
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
    plugin.textToSpeech!({
      lang,
      tts: true,
      content,
      success: (res: TtsResponse) => {
        if (res.retcode !== undefined && res.retcode !== 0) {
          reject(new Error(res.msg || '语音合成失败'))
          return
        }
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

export function textToSpeech(lang: string, content: string): Promise<string> {
  const plugin = getWechatSiPlugin()
  if (!plugin) {
    return Promise.reject(new Error(loadError || '微信同声传译插件未授权'))
  }

  const piece = content.trim()
  if (!piece) return Promise.reject(new Error('朗读内容为空'))
  if (piece.length > TTS_MAX_CHARS) {
    return Promise.reject(new Error('单段文本超过插件长度限制'))
  }

  return callTextToSpeech(plugin, lang, piece)
}
