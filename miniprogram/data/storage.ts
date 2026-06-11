const STORAGE_KEYS = {
  progress: 'hanzi_progress',
  profile: 'hanzi_profile',
  snapshots: 'hanzi_snapshots',
} as const

export function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = wx.getStorageSync(key)
    if (raw === '' || raw === undefined || raw === null) return fallback
    return raw as T
  } catch {
    return fallback
  }
}

export function setStorage<T>(key: string, value: T): void {
  wx.setStorageSync(key, value)
}

export function startOfDay(ms: number = Date.now()): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function formatRelativeDate(ms: number | null): string {
  if (ms === null) return ''
  const now = Date.now()
  const diff = ms - now
  const days = Math.ceil(diff / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  if (days <= 7) return `${days} 天后`
  const d = new Date(ms)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export { STORAGE_KEYS }
