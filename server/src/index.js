const express = require('express')
const cors = require('cors')
const { config } = require('./config')
const { pool } = require('./db')
const authRoutes = require('./routes/auth')
const syncRoutes = require('./routes/sync')

const app = express()

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, service: 'hanzi-island-server' })
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/sync', syncRoutes)

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err)
  res.status(500).json({ ok: false, message: err.message || '服务器错误' })
})

app.listen(config.port, () => {
  console.log(`Hanzi Island API listening on http://127.0.0.1:${config.port}`)
  console.log(`mock login: ${config.allowMockLogin ? 'ON' : 'OFF'}`)
})
