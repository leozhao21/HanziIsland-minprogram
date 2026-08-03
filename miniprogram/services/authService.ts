import { AUTH_STORAGE_KEYS } from '../config/env'
import { ApiError, request } from './apiClient'

export interface CloudUserSession {
  token: string
  openid: string
  userId: number
}

function readString(key: string): string {
  try {
    return wx.getStorageSync(key) || ''
  } catch {
    return ''
  }
}

function writeSession(session: CloudUserSession): void {
  wx.setStorageSync(AUTH_STORAGE_KEYS.token, session.token)
  wx.setStorageSync(AUTH_STORAGE_KEYS.openid, session.openid)
  wx.setStorageSync(AUTH_STORAGE_KEYS.userId, session.userId)
}

export function getSavedSession(): CloudUserSession | null {
  const token = readString(AUTH_STORAGE_KEYS.token)
  const openid = readString(AUTH_STORAGE_KEYS.openid)
  if (!token || !openid) return null
  return {
    token,
    openid,
    userId: Number(wx.getStorageSync(AUTH_STORAGE_KEYS.userId) || 0),
  }
}

export function clearSession(): void {
  wx.removeStorageSync(AUTH_STORAGE_KEYS.token)
  wx.removeStorageSync(AUTH_STORAGE_KEYS.openid)
  wx.removeStorageSync(AUTH_STORAGE_KEYS.userId)
  // 清理旧版头像/昵称缓存
  wx.removeStorageSync('hanzi_cloud_nick_name')
  wx.removeStorageSync('hanzi_cloud_avatar_url')
}

export function isLoggedIn(): boolean {
  return !!getSavedSession()
}

function wxLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) resolve(res.code)
        else reject(new Error('wx.login 未返回 code'))
      },
      fail(err) {
        reject(new Error(err.errMsg || 'wx.login 失败'))
      },
    })
  })
}

export async function loginWithWeChat(): Promise<CloudUserSession> {
  const code = await wxLogin()
  const data = await request<{
    token: string
    openid: string
    userId: number
  }>({
    path: '/api/auth/login',
    method: 'POST',
    auth: false,
    data: { code },
  })

  const session: CloudUserSession = {
    token: data.token,
    openid: data.openid,
    userId: data.userId,
  }
  writeSession(session)
  return session
}

export async function ensureLogin(): Promise<CloudUserSession> {
  const saved = getSavedSession()
  if (saved) {
    try {
      await request({ path: '/api/auth/me', method: 'GET' })
      return saved
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
      } else {
        return saved
      }
    }
  }
  return loginWithWeChat()
}
