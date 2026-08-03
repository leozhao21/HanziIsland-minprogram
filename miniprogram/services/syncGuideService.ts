import { AUTH_STORAGE_KEYS } from '../config/env'
import { isLoggedIn } from './authService'

export function hasPromptedSyncGuide(): boolean {
  try {
    return !!wx.getStorageSync(AUTH_STORAGE_KEYS.syncGuidePrompted)
  } catch {
    return false
  }
}

export function markSyncGuidePrompted(): void {
  wx.setStorageSync(AUTH_STORAGE_KEYS.syncGuidePrompted, 1)
}

/**
 * 首次完成当日学习目标、且尚未开启云同步时，引导开启同步。
 * 每个安装生命周期只提示一次。
 */
export function shouldPromptSyncGuide(params: {
  isLoaded: boolean
  charactersStudied: number
  goal: number
}): boolean {
  if (!params.isLoaded) return false
  if (isLoggedIn()) return false
  if (hasPromptedSyncGuide()) return false
  if (params.goal <= 0) return false
  return params.charactersStudied >= params.goal
}
