const app = getApp()

Page({
  data: {
    userInfo: null,
    avatarSrc: '',
    showPreview: false
  },

  onLoad() {
    try {
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = systemInfo.statusBarHeight || 20
      const navHeight = menuButton ? (menuButton.top - statusBarHeight) * 2 + menuButton.height : 44
      this.setData({ statusBarHeight, navHeight })
    } catch (e) {
      this.setData({ statusBarHeight: 20, navHeight: 44 })
    }
  },

  onShow() {
    this.loadProfile()
  },

  loadProfile() {
    if (!app.globalData.token) return
    app.request({
      url: '/auth/profile/'
    }).then(user => {
      const current = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}
      const updatedUser = { ...current, ...user }
      app.globalData.userInfo = updatedUser
      wx.setStorageSync('userInfo', updatedUser)
      const avatarSrc = updatedUser.avatar_url || '/images/default-avatar.jpg'
      this.setData({
        userInfo: updatedUser,
        avatarSrc
      })
    }).catch(() => {
      const user = app.globalData.userInfo
      if (user) {
        const avatarSrc = user.avatar_url || '/images/default-avatar.jpg'
        this.setData({ userInfo: user, avatarSrc })
      }
    })
  },

  onAvatarTap() {
    wx.showActionSheet({
      itemList: ['查看大图', '修改昵称', '更换头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ showPreview: true })
        } else if (res.tapIndex === 1) {
          this.editNickname()
        } else if (res.tapIndex === 2) {
          this.uploadAvatar()
        }
      }
    })
  },

  deleteRole() {
    wx.showModal({
      title: '确认删除职责',
      content: '确定要清除你的职责标签吗？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: '/auth/profile/',
            method: 'POST',
            data: { role: '' }
          }).then(() => {
            wx.showToast({ title: '职责已删除', icon: 'success' })
            this.loadProfile()
          }).catch(() => {
            wx.showToast({ title: '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  editNickname() {
    wx.showModal({
      title: '修改我的昵称',
      editable: true,
      placeholderText: this.data.userInfo ? this.data.userInfo.nickname : '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          app.request({
            url: '/auth/nickname/',
            method: 'POST',
            data: { nickname: res.content.trim() }
          }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.loadProfile()
          }).catch(err => {
            const msg = err.data && err.data.error ? err.data.error : '修改失败'
            wx.showToast({ title: msg, icon: 'none' })
          })
        }
      }
    })
  },

  uploadAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        app.uploadFile({
          url: '/auth/profile/',
          filePath,
          name: 'avatar'
        }).then(() => {
          wx.hideLoading()
          wx.showToast({ title: '头像已更新', icon: 'success' })
          this.loadProfile()
        }).catch(() => {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
        })
      }
    })
  },

  editRole() {
    wx.showModal({
      title: '修改职责',
      editable: true,
      placeholderText: '如：司机、导游、摄影...',
      success: (res) => {
        if (res.confirm && res.content) {
          app.request({
            url: '/auth/profile/',
            method: 'POST',
            data: { role: res.content }
          }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.loadProfile()
          }).catch(() => {
            wx.showToast({ title: '更新失败', icon: 'none' })
          })
        }
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '我和青春有个约定',
      content: '一群平均年龄 30 岁的中登老男人，他们曾经是意气风发的少年，为了生活，盲目奔波；岁月的杀猪刀已将他们磨灭的日渐消瘦；在这即将 30 岁的日子，期待他们来一场疯狂的旅行.......',
      showCancel: false
    })
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
