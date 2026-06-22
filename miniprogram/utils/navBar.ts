export interface NavBarLayout {
  statusBarHeight: number
  navContentHeight: number
  navBarHeight: number
}

/** 按胶囊按钮位置计算自定义导航栏高度（小程序通用方案） */
export function getNavBarLayout(): NavBarLayout {
  const windowInfo = wx.getWindowInfo()
  const menuButton = wx.getMenuButtonBoundingClientRect()
  const statusBarHeight = windowInfo.statusBarHeight
  const navContentHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
  return {
    statusBarHeight,
    navContentHeight,
    navBarHeight: statusBarHeight + navContentHeight,
  }
}
