/** 云端 API 基础地址。真机调试请改成可访问的局域网 IP 或已备案域名。 */
export const API_BASE_URL = 'https://www.ushow.ink/4000'

export const AUTH_STORAGE_KEYS = {
  token: 'hanzi_cloud_token',
  openid: 'hanzi_cloud_openid',
  userId: 'hanzi_cloud_user_id',
  /** 是否已展示过「首次完成目标 → 引导开启同步」弹窗 */
  syncGuidePrompted: 'hanzi_sync_guide_prompted',
} as const
