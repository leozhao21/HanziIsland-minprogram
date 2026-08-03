const express = require('express')
const { query } = require('../db')
const { code2Session } = require('../services/wechat')
const { signToken, authRequired } = require('../middleware/auth')

const router = express.Router()

function sanitizeText(value, maxLen) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  return text.slice(0, maxLen)
}

router.post('/login', async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body || {}
    const session = await code2Session(code)
    const safeNick = sanitizeText(nickName, 64)
    const safeAvatar = sanitizeText(avatarUrl, 512)

    const existing = await query('SELECT id, openid, nick_name, avatar_url FROM users WHERE openid = ? LIMIT 1', [
      session.openid,
    ])

    let user
    if (existing.length > 0) {
      user = existing[0]
      if (safeNick || safeAvatar || session.unionid) {
        await query(
          `UPDATE users
           SET nick_name = COALESCE(?, nick_name),
               avatar_url = COALESCE(?, avatar_url),
               unionid = COALESCE(?, unionid)
           WHERE id = ?`,
          [safeNick, safeAvatar, session.unionid || null, user.id],
        )
        const refreshed = await query(
          'SELECT id, openid, nick_name, avatar_url FROM users WHERE id = ? LIMIT 1',
          [user.id],
        )
        user = refreshed[0]
      }
    } else {
      const result = await query(
        `INSERT INTO users (openid, unionid, nick_name, avatar_url)
         VALUES (?, ?, ?, ?)`,
        [session.openid, session.unionid || null, safeNick, safeAvatar],
      )
      user = {
        id: result.insertId,
        openid: session.openid,
        nick_name: safeNick,
        avatar_url: safeAvatar,
      }
    }

    const token = signToken({ userId: user.id, openid: user.openid })
    return res.json({
      ok: true,
      data: {
        token,
        openid: user.openid,
        userId: user.id,
        nickName: user.nick_name,
        avatarUrl: user.avatar_url,
      },
    })
  } catch (err) {
    const status = err.status || 500
    console.error('[auth/login]', err)
    return res.status(status).json({
      ok: false,
      message: err.message || '登录失败',
      detail: err.detail,
    })
  }
})

router.put('/profile', authRequired, async (req, res) => {
  try {
    const nickName = sanitizeText(req.body?.nickName, 64)
    const avatarUrl = sanitizeText(req.body?.avatarUrl, 512)
    await query(
      `UPDATE users
       SET nick_name = COALESCE(?, nick_name),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [nickName, avatarUrl, req.user.userId],
    )
    const rows = await query(
      'SELECT id, openid, nick_name, avatar_url FROM users WHERE id = ? LIMIT 1',
      [req.user.userId],
    )
    const user = rows[0]
    return res.json({
      ok: true,
      data: {
        userId: user.id,
        openid: user.openid,
        nickName: user.nick_name,
        avatarUrl: user.avatar_url,
      },
    })
  } catch (err) {
    console.error('[auth/profile]', err)
    return res.status(500).json({ ok: false, message: err.message || '更新资料失败' })
  }
})

router.get('/me', authRequired, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, openid, nick_name, avatar_url, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.userId],
    )
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: '用户不存在' })
    }
    const user = rows[0]
    return res.json({
      ok: true,
      data: {
        userId: user.id,
        openid: user.openid,
        nickName: user.nick_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    })
  } catch (err) {
    console.error('[auth/me]', err)
    return res.status(500).json({ ok: false, message: err.message || '获取用户失败' })
  }
})

module.exports = router
