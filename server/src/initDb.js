const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
require('dotenv').config()

async function main() {
  console.log(process.env)
  const {
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env
  

  const schemaPath = path.join(__dirname, '../sql/schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    multipleStatements: true,
  })

  try {
    await connection.query(sql)
    console.log(`数据库初始化完成: ${MYSQL_DATABASE}`)
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error('初始化失败:', err.message)
  process.exit(1)
})
