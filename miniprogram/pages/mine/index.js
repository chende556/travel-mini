const app = getApp()

Page({
  data: {
    userInfo: null,
    showPreview: false
  },

  onShow() {
    this.setData({
      userInfo: app.globalData.userInfo
    })
  },

  onAbout() {
    wx.showModal({
      title: '我和青春有个约定',
      content: '一群平均年龄 30 岁的中登老男人，他们曾经是意气风发的少年，为了生活，盲目奔波；岁月的杀猪刀已将他们磨灭的日渐消瘦；在这即将 30 岁的日子，期待他们来一场疯狂的旅行.......',
      showCancel: false
    })
  },

  onPreviewAvatar() {
    this.setData({ showPreview: true })
  },

  onClosePreview() {
    this.setData({ showPreview: false })
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success(res) {
        if (res.confirm) {
          app.globalData.token = ''
          app.globalData.userInfo = null
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  }
})
