import {
  CharacterProgressEntity,
  DailyStudySnapshot,
  PinyinAgeMode,
  recommendedDailyGoal,
  StudyMode,
  UserProfileEntity,
} from '../domain/models'
import {
  bumpLocalSyncUpdatedAt,
  getLocalSyncUpdatedAt,
  getStorage,
  STORAGE_KEYS,
} from './storage'
import { request, requestRaw } from '../services/apiClient'
import { isLoggedIn } from '../services/authService'

export interface CloudSyncPayload {
  progress: CharacterProgressEntity[]
  profile: UserProfileEntity
  snapshots: DailyStudySnapshot[]
  clientUpdatedAt: number
}

const DEFAULT_PROFILE: UserProfileEntity = {
  starCount: 0,
  studyModeRaw: StudyMode.Standard,
  unlockedIslandIds: [],
  weeklyMasteredIds: [],
  dailyLearningGoal: recommendedDailyGoal(StudyMode.Standard),
  followStudyModeGoal: true,
  pinyinBreakdownEnabled: true,
  pinyinAgeModeRaw: PinyinAgeMode.Young,
  homeWelcomeSpeechEnabled: true,
}

export { bumpLocalSyncUpdatedAt, getLocalSyncUpdatedAt }

function normalizeArray<T>(value: unknown): T[] {
  let current: unknown = value
  for (let i = 0; i < 3; i += 1) {
    if (Array.isArray(current)) return current as T[]
    if (typeof current !== 'string') return []
    try {
      current = JSON.parse(current)
    } catch {
      return []
    }
  }
  return []
}

function normalizeProfile(value: unknown): UserProfileEntity | null {
  let current: unknown = value
  for (let i = 0; i < 3; i += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current as UserProfileEntity
    }
    if (typeof current !== 'string') return null
    try {
      current = JSON.parse(current)
    } catch {
      return null
    }
  }
  return null
}

function isEmptyProgress(progress: CharacterProgressEntity[] | undefined): boolean {
  return !progress || progress.length === 0
}

export function collectLocalSyncPayload(): CloudSyncPayload {
  return {
    progress: getStorage<CharacterProgressEntity[]>(STORAGE_KEYS.progress, []),
    profile: getStorage<UserProfileEntity>(STORAGE_KEYS.profile, DEFAULT_PROFILE),
    snapshots: getStorage<DailyStudySnapshot[]>(STORAGE_KEYS.snapshots, []),
    clientUpdatedAt: getLocalSyncUpdatedAt(),
  }
}

export function applyLocalSyncPayload(payload: CloudSyncPayload): number {
  const progress = normalizeArray<CharacterProgressEntity>(payload.progress)
  const snapshots = normalizeArray<DailyStudySnapshot>(payload.snapshots)
  const profile = normalizeProfile(payload.profile) || DEFAULT_PROFILE

  // 分 key 写入，并回读校验，避免“写失败却当成功”
  wx.setStorageSync(STORAGE_KEYS.progress, progress)
  wx.setStorageSync(STORAGE_KEYS.profile, profile)
  wx.setStorageSync(STORAGE_KEYS.snapshots, snapshots)
  bumpLocalSyncUpdatedAt(payload.clientUpdatedAt || Date.now())

  const verify = wx.getStorageSync(STORAGE_KEYS.progress)
  const verifyCount = Array.isArray(verify) ? verify.length : 0
  if (verifyCount !== progress.length) {
    throw new Error(`本地写入失败（期望${progress.length}，实际${verifyCount}）`)
  }
  return progress.length
}

export async function pullRemoteSync(): Promise<{ exists: boolean; data: CloudSyncPayload }> {
  const { statusCode, body } = await requestRaw<{
    ok?: boolean
    exists?: boolean
    message?: string
    data?: {
      progress?: unknown
      profile?: unknown
      snapshots?: unknown
      clientUpdatedAt?: number
      progressCount?: number
    }
  }>({
    path: '/api/sync',
    method: 'GET',
  })

  if (statusCode < 200 || statusCode >= 300 || !body || body.ok === false) {
    throw new Error((body && body.message) || `拉取失败(${statusCode})`)
  }

  const data = body.data || {}
  const progress = normalizeArray<CharacterProgressEntity>(data.progress)
  return {
    exists: !!body.exists,
    data: {
      progress,
      profile: normalizeProfile(data.profile),
      snapshots: normalizeArray<DailyStudySnapshot>(data.snapshots),
      clientUpdatedAt: Number(data.clientUpdatedAt) || 0,
    } as CloudSyncPayload,
  }
}

export async function pushRemoteSync(payload: CloudSyncPayload, force = false): Promise<CloudSyncPayload> {
  return request<CloudSyncPayload>({
    path: '/api/sync',
    method: 'PUT',
    data: {
      progress: normalizeArray(payload.progress),
      profile: normalizeProfile(payload.profile) || DEFAULT_PROFILE,
      snapshots: normalizeArray(payload.snapshots),
      clientUpdatedAt: payload.clientUpdatedAt || Date.now(),
      force,
    },
  })
}

export async function reconcileCloudSync(): Promise<{
  action: 'pulled' | 'pushed' | 'noop'
  payload: CloudSyncPayload
}> {
  if (!isLoggedIn()) {
    throw new Error('未登录')
  }

  const local = collectLocalSyncPayload()
  const remote = await pullRemoteSync()
  const remoteAt = Number(remote.data.clientUpdatedAt) || 0
  const localAt = Number(local.clientUpdatedAt) || 0
  const remoteProfile = normalizeProfile(remote.data.profile)
  const remoteHasRecord = remote.exists && !!remoteProfile

  if (!remoteHasRecord) {
    const toPush: CloudSyncPayload = {
      ...local,
      profile: local.profile || DEFAULT_PROFILE,
      clientUpdatedAt: localAt || bumpLocalSyncUpdatedAt(),
    }
    const pushed = await pushRemoteSync(toPush, true)
    return { action: 'pushed', payload: pushed }
  }

  const remotePayload: CloudSyncPayload = {
    progress: remote.data.progress || [],
    profile: remoteProfile || DEFAULT_PROFILE,
    snapshots: remote.data.snapshots || [],
    clientUpdatedAt: remoteAt,
  }

  // 本地无进度、云端有进度：始终拉取（比时间戳更优先）
  if (isEmptyProgress(local.progress) && !isEmptyProgress(remotePayload.progress)) {
    applyLocalSyncPayload(remotePayload)
    return { action: 'pulled', payload: remotePayload }
  }

  if (localAt === 0 && remoteAt > 0) {
    applyLocalSyncPayload(remotePayload)
    return { action: 'pulled', payload: remotePayload }
  }

  if (remoteAt > localAt) {
    applyLocalSyncPayload(remotePayload)
    return { action: 'pulled', payload: remotePayload }
  }

  if (localAt > remoteAt) {
    if (isEmptyProgress(local.progress) && !isEmptyProgress(remotePayload.progress)) {
      applyLocalSyncPayload(remotePayload)
      return { action: 'pulled', payload: remotePayload }
    }
    const pushed = await pushRemoteSync({
      ...local,
      profile: local.profile || DEFAULT_PROFILE,
    })
    return { action: 'pushed', payload: pushed }
  }

  return { action: 'noop', payload: local }
}

export async function uploadLocalProgress(force = false): Promise<CloudSyncPayload> {
  const local = collectLocalSyncPayload()
  const clientUpdatedAt = local.clientUpdatedAt || bumpLocalSyncUpdatedAt()
  return pushRemoteSync(
    {
      ...local,
      profile: local.profile || DEFAULT_PROFILE,
      clientUpdatedAt,
    },
    force,
  )
}

/** 强制从云端拉取并覆盖本地（用于手动恢复） */
export async function forcePullFromCloud(): Promise<CloudSyncPayload & { progressCount: number }> {
  if (!isLoggedIn()) {
    throw new Error('未登录')
  }
  const remote = await pullRemoteSync()
  if (!remote.exists) {
    throw new Error('云端暂无存档')
  }
  const profile = normalizeProfile(remote.data.profile)
  if (!profile) {
    throw new Error('云端存档缺少用户资料')
  }
  const progress = normalizeArray<CharacterProgressEntity>(remote.data.progress)
  if (progress.length === 0) {
    throw new Error('云端暂无汉字学习记录')
  }

  const payload: CloudSyncPayload = {
    progress,
    profile,
    snapshots: normalizeArray<DailyStudySnapshot>(remote.data.snapshots),
    clientUpdatedAt: Number(remote.data.clientUpdatedAt) || Date.now(),
  }
  const progressCount = applyLocalSyncPayload(payload)
  return {
    ...payload,
    progressCount,
  }
}
