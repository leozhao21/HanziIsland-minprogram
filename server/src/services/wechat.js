const https = require('https')
const { config } = require('../config')

/**
 * 简易 GET JSON（兼容 Node 16，不依赖全局 fetch）
 * @param {string | URL} url
 * @returns {Promise<object>}
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(String(url), (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (err) {
          reject(Object.assign(new Error('微信接口返回非 JSON'), { status: 502, detail: raw }))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy(new Error('请求微信接口超时'))
    })
  })
}

/**
 * 用 wx.login 拿到的 code 换取 openid / session_key
 * @param {string} code
 * @returns {Promise<{ openid: string, session_key?: string, unionid?: string }>}
 */
async function code2Session(code) {
  if (!code) {
    throw Object.assign(new Error('缺少 code'), { status: 400 })
  }

  if (config.allowMockLogin && code.startsWith('mock_')) {
    return { openid: `mock_${code.slice(5)}` }
  }

  if (!config.wechat.appId || !config.wechat.secret) {
    throw Object.assign(new Error('服务端未配置 WECHAT_APPID / WECHAT_SECRET'), { status: 500 })
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', config.wechat.appId)
  url.searchParams.set('secret', config.wechat.secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const data = await getJson(url)

  if (data.errcode) {
    throw Object.assign(new Error(data.errmsg || `微信登录失败(${data.errcode})`), {
      status: 401,
      detail: data,
    })
  }

  if (!data.openid) {
    throw Object.assign(new Error('微信未返回 openid'), { status: 502 })
  }

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid,
  }
}

module.exports = { code2Session }
