const jwt = require('jsonwebtoken')
const { config } = require('../config')

function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return res.status(401).json({ ok: false, message: '未登录' })
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = {
      userId: decoded.userId,
      openid: decoded.openid,
    }
    return next()
  } catch {
    return res.status(401).json({ ok: false, message: '登录已失效，请重新授权' })
  }
}

module.exports = { signToken, authRequired }
