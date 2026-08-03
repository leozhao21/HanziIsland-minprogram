const express = require('express')
const { query } = require('../db')
const { authRequired } = require('../middleware/auth')

const router = express.Router()

function parseJsonField(value, fallback) {
  let current = value
  // 兼容被双重 JSON 编码成字符串的情况
  for (let i = 0; i < 3; i += 1) {
    if (current == null) return fallback
    if (typeof current === 'object') return current
    if (typeof current !== 'string') return fallback
    try {
      current = JSON.parse(current)
    } catch {
      return fallback
    }
  }
  return typeof current === 'object' && current != null ? current : fallback
}

function toMillis(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'bigint') return Number(value)
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function emptyPayload() {
  return {
    progress: [],
    profile: null,
    snapshots: [],
    clientUpdatedAt: 0,
  }
}

router.get('/', authRequired, async (req, res) => {
  try {
    const rows = await query(
      `SELECT progress_json, profile_json, snapshots_json, client_updated_at, updated_at
       FROM study_sync WHERE user_id = ? LIMIT 1`,
      [req.user.userId],
    )

    if (!rows.length) {
      return res.json({ ok: true, data: emptyPayload(), exists: false })
    }

    const row = rows[0]
    const progress = parseJsonField(row.progress_json, [])
    const profile = parseJsonField(row.profile_json, null)
    const snapshots = parseJsonField(row.snapshots_json, [])

    return res.json({
      ok: true,
      exists: true,
      data: {
        progress: Array.isArray(progress) ? progress : [],
        profile,
        snapshots: Array.isArray(snapshots) ? snapshots : [],
        clientUpdatedAt: toMillis(row.client_updated_at),
        serverUpdatedAt: row.updated_at,
        progressCount: Array.isArray(progress) ? progress.length : 0,
      },
    })
  } catch (err) {
    console.error('[sync/get]', err)
    return res.status(500).json({ ok: false, message: err.message || '读取进度失败' })
  }
})

router.put('/', authRequired, async (req, res) => {
  try {
    const body = req.body || {}
    const progress = Array.isArray(body.progress) ? body.progress : []
    const snapshots = Array.isArray(body.snapshots) ? body.snapshots : []
    const profile = body.profile && typeof body.profile === 'object' ? body.profile : null
    const clientUpdatedAt = Number(body.clientUpdatedAt) || Date.now()

    if (!profile) {
      return res.status(400).json({ ok: false, message: '缺少 profile' })
    }

    const existing = await query(
      `SELECT client_updated_at, progress_json
       FROM study_sync WHERE user_id = ? LIMIT 1`,
      [req.user.userId],
    )

    if (existing.length > 0) {
      const remoteUpdatedAt = toMillis(existing[0].client_updated_at)
      const remoteProgress = parseJsonField(existing[0].progress_json, [])
      const remoteCount = Array.isArray(remoteProgress) ? remoteProgress.length : 0

      if (!body.force && clientUpdatedAt < remoteUpdatedAt) {
        return res.status(409).json({
          ok: false,
          message: '云端进度更新，请先拉取再上传',
          data: { remoteClientUpdatedAt: remoteUpdatedAt },
        })
      }

      // 防止空进度在非强制情况下覆盖云端已有学习记录
      if (!body.force && progress.length === 0 && remoteCount > 0) {
        return res.status(409).json({
          ok: false,
          message: '本地进度为空，已拒绝覆盖云端学习记录',
          data: { remoteProgressCount: remoteCount },
        })
      }

      await query(
        `UPDATE study_sync
         SET progress_json = ?,
             profile_json = ?,
             snapshots_json = ?,
             client_updated_at = ?
         WHERE user_id = ?`,
        [
          JSON.stringify(progress),
          JSON.stringify(profile),
          JSON.stringify(snapshots),
          clientUpdatedAt,
          req.user.userId,
        ],
      )
    } else {
      await query(
        `INSERT INTO study_sync (user_id, progress_json, profile_json, snapshots_json, client_updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.userId,
          JSON.stringify(progress),
          JSON.stringify(profile),
          JSON.stringify(snapshots),
          clientUpdatedAt,
        ],
      )
    }

    console.log(
      `[sync/put] user=${req.user.userId} progress=${progress.length} snapshots=${snapshots.length} at=${clientUpdatedAt} force=${!!body.force}`,
    )

    return res.json({
      ok: true,
      data: {
        progress,
        profile,
        snapshots,
        clientUpdatedAt,
        progressCount: progress.length,
      },
    })
  } catch (err) {
    console.error('[sync/put]', err)
    return res.status(500).json({ ok: false, message: err.message || '保存进度失败' })
  }
})

module.exports = router
