require('dotenv').config()

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`缺少环境变量: ${name}`)
  }
  return value
}

const config = {
  port: Number(process.env.PORT || 3000),
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || '',
  },
  jwt: {
    secret: required('JWT_SECRET', 'hanzi-island-dev-secret-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'zlei260725',
  },
  allowMockLogin: String(process.env.ALLOW_MOCK_LOGIN || 'false').toLowerCase() === 'true',
}

module.exports = { config }
