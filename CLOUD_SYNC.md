# 汉字奇遇岛 · 云端同步说明

本仓库现包含：

- `miniprogram/`：微信小程序（本地学习 + 云端同步）
- `server/`：Node.js + MySQL 后台（openid 登录、进度存取）

## 同步交互

1. 首次可直接本地体验，数据先写入缓存
2. **第一次完成当日学习目标**后，若未开启同步，弹窗引导开启（可不经家长门禁，直接授权）
3. 开启后本地学习变更会自动上传；启动时若已登录会自动对账同步
4. 家长中心 → 设置中也可随时开启 / 关闭 / 手动同步

## 启动后台

```bash
cd server
cp .env.example .env
# 填写 WECHAT_SECRET、MySQL、JWT_SECRET

npm install
npm run init-db
npm run dev
```

详细 API 见 `server/README.md`。

## 小程序配置

1. 修改 `miniprogram/config/env.ts` 中的 `API_BASE_URL`
   - 模拟器可用 `http://127.0.0.1:3000`
   - 真机请改为电脑局域网 IP，如 `http://192.168.1.8:3000`
2. 微信开发者工具勾选：**详情 → 本地设置 → 不校验合法域名**
3. 正式环境需在小程序后台配置 request 合法域名，并使用 HTTPS

## 微信后台

1. 获取 AppSecret：小程序后台 → 开发管理 → 开发设置
2. 填入 `server/.env` 的 `WECHAT_SECRET`
3. `WECHAT_APPID` 需与 `project.config.json` 的 appid 一致（当前为 `wxa5e8b9406637e57a`）
