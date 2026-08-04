# 汉字奇遇岛 · 学习进度云端服务

Node.js + Express + MySQL，为微信小程序提供：

1. `wx.login` code → openid 登录
2. 用户昵称 / 头像资料保存
3. 学习进度（progress / profile / snapshots）云端读写

## 快速开始

```bash
cd server
cp .env.example .env
# 编辑 .env：填入 WECHAT_SECRET、MySQL 账号、JWT_SECRET

npm install
npm run init-db
npm run dev
```

健康检查：`GET http://127.0.0.1:3000/health`

## 生产部署（PM2）

```bash
cd server
npm install
npm run init-db   # 首次部署

npm run pm2:start     # 启动（production）
npm run pm2:status    # 查看状态
npm run pm2:logs      # 查看日志
npm run pm2:restart   # 重启
npm run pm2:reload    # 零停机重载
npm run pm2:stop      # 停止
npm run pm2:delete    # 从 PM2 列表移除
```

开机自启（首次在服务器上执行一次）：

```bash
npm run pm2:startup   # 按提示执行生成的命令
npm run pm2:save      # 保存当前进程列表
```

配置见 `ecosystem.config.js`，日志写入 `server/logs/`。

## 环境变量

见 `.env.example`。生产环境务必：

- 配置真实 `WECHAT_APPID` / `WECHAT_SECRET`
- 设置足够长的 `JWT_SECRET`
- 关闭 `ALLOW_MOCK_LOGIN`

## API

### `POST /api/auth/login`

```json
{ "code": "wx.login返回的code", "nickName": "可选", "avatarUrl": "可选" }
```

返回：

```json
{
  "ok": true,
  "data": {
    "token": "JWT",
    "openid": "...",
    "userId": 1,
    "nickName": "...",
    "avatarUrl": "..."
  }
}
```

### `GET /api/auth/me` / `PUT /api/auth/profile`

需 `Authorization: Bearer <token>`。

### `GET /api/sync`

拉取云端进度。

### `PUT /api/sync`

上传完整进度包：

```json
{
  "progress": [],
  "profile": {},
  "snapshots": [],
  "clientUpdatedAt": 1710000000000,
  "force": false
}
```

冲突策略：若云端 `clientUpdatedAt` 更新且未传 `force: true`，返回 `409`。

## 本地调试（无真实微信密钥）

`.env` 设置：

```
ALLOW_MOCK_LOGIN=true
```

小程序可用 `code: "mock_test_user"` 登录（openid = `mock_test_user`）。

## 微信后台配置

1. 小程序后台 → 开发 → 开发管理 → 开发设置：复制 AppSecret
2. 开发 → 开发管理 → 开发设置 → 服务器域名：将 API 域名加入 **request 合法域名**
3. 本地开发者工具可勾选「不校验合法域名」
