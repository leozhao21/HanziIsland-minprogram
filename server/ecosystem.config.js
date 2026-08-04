/**
 * PM2 进程管理配置
 *
 * 常用命令（在 server 目录下）：
 *   npm run pm2:start    # 生产环境启动
 *   npm run pm2:stop     # 停止
 *   npm run pm2:restart  # 重启
 *   npm run pm2:reload   # 零停机重载
 *   npm run pm2:logs     # 查看日志
 *   npm run pm2:status   # 进程状态
 */
module.exports = {
  apps: [
    {
      name: 'hanzi-island-server',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    },
  ],
}
