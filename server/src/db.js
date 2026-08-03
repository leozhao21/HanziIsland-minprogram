const mysql = require('mysql2/promise')
const { config } = require('./config')

const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: 'Z',
})

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

module.exports = { pool, query }
