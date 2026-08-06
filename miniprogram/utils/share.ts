/** 分享 / 收藏卡片统一使用小程序图标 */
export const SHARE_IMAGE_URL = '/assets/share-cover.png'

export const SHARE_TITLE = '汉字奇遇岛 — 一起来学汉字吧！'

export const SHARE_PATH = '/pages/home/index'

export function getShareAppMessage() {
  return {
    title: SHARE_TITLE,
    path: SHARE_PATH,
    imageUrl: SHARE_IMAGE_URL,
  }
}

export function getShareTimeline() {
  return {
    title: SHARE_TITLE,
    query: '',
    imageUrl: SHARE_IMAGE_URL,
  }
}

/** 右上角「收藏」自定义内容 */
export function getAddToFavorites() {
  return {
    title: SHARE_TITLE,
    imageUrl: SHARE_IMAGE_URL,
    query: '',
  }
}
