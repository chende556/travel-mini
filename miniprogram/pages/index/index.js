const app = getApp()

Page({
  data: {
    isLogin: false,
    trips: [],
    members: [],
    loading: false,
    previewAvatar: '',
    showNicknamePicker: false,
    nicknameOptions: [
      { name: '潮唧唧', avatar: '/images/1_jiji.jpg' },
      { name: '飞机', avatar: '/images/2_feiji.jpg' },
      { name: '宝哥', avatar: '/images/3_baoge.jpg' },
      { name: '平胸', avatar: '/images/4_pingxion.jpg' },
      { name: '老伍', avatar: '/images/5_xiaowu.jpg' }
    ],
    comments: [],
    commentText: ''
  },

  onShow() {
    if (app.globalData.token) {
      this.setData({ isLogin: true })
      this.loadTrips()
      this.loadMembers()
      // 检查是否有昵称
      const userInfo = app.globalData.userInfo
      if (!userInfo || !userInfo.nickname) {
        this.setData({ showNicknamePicker: true })
      }
    }
  },

  // 微信登录
  onLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          app.request({
            url: '/auth/login/',
            method: 'POST',
            data: { code: res.code }
          }).then(data => {
            // 保存 token
            app.globalData.token = data.token
            app.globalData.userInfo = data.user
            wx.setStorageSync('token', data.token)
            wx.setStorageSync('userInfo', data.user)
            
            this.setData({ isLogin: true })
            this.loadTrips()

            wx.showToast({ title: '登录成功', icon: 'success' })
          }).catch(err => {
            console.error('登录失败', err)
            wx.showToast({ title: '登录失败', icon: 'none' })
          })
        }
      }
    })
  },

  // 加载成员列表
  loadMembers() {
    app.request({ url: '/auth/members/' }).then(data => {
      this.setData({ members: data })
    })
  },

  // 点击成员头像
  onMemberTap(e) {
    const member = e.currentTarget.dataset.member
    const userInfo = app.globalData.userInfo
    const nickname = member.nickname

    // 获取显示的头像 src（和 wxml 里的逻辑一致）
    const avatarMap = {
      '潮唧唧': '/images/1_jiji.jpg',
      '飞机': '/images/2_feiji.jpg',
      '宝哥': '/images/3_baoge.jpg',
      '平胸': '/images/4_pingxion.jpg',
      '老伍': '/images/5_xiaowu.jpg'
    }
    const avatarSrc = member.avatar_url || avatarMap[nickname] || '/images/group-avatar.jpg'

    if (userInfo && member.id === userInfo.id) {
      // 是自己，弹出操作菜单
      wx.showActionSheet({
        itemList: ['查看头像', '更换头像', '修改职责'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.setData({ previewAvatar: avatarSrc })
          } else if (res.tapIndex === 1) {
            this.uploadAvatar()
          } else if (res.tapIndex === 2) {
            this.editRole()
          }
        }
      })
    } else {
      // 不是自己，直接预览头像
      this.setData({ previewAvatar: avatarSrc })
    }
  },

  // 上传头像
  uploadAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        app.uploadFile({
          url: '/auth/profile/',
          filePath,
          name: 'avatar'
        }).then(() => {
          wx.showToast({ title: '头像已更新', icon: 'success' })
          this.loadMembers()
        }).catch(() => {
          wx.showToast({ title: '上传失败', icon: 'none' })
        })
      }
    })
  },

  // 修改职责
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
            this.loadMembers()
          })
        }
      }
    })
  },

  // 加载行程列表
  loadTrips() {
    this.setData({ loading: true })
    app.request({
      url: '/trips/'
    }).then(data => {
      const trips = data.results || data
      // 计算倒计时
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      trips.forEach(trip => {
        const start = new Date(trip.start_date)
        start.setHours(0, 0, 0, 0)
        const diff = Math.ceil((start - today) / (1000 * 60 * 60 * 24))
        trip.countdown = diff
      })
      this.setData({ trips, loading: false })
      // 加载评论
      this.loadComments()
    }).catch(err => {
      console.error('加载失败', err)
      this.setData({ loading: false })
    })
  },

  // 新建行程
  onAddTrip() {
    wx.navigateTo({ url: '/pages/trip/edit' })
  },

  // 查看行程详情
  onTripDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/trip/detail?id=${id}` })
  },

  // 点击头像放大查看
  onPreviewAvatar(e) {
    const src = e.currentTarget.dataset.src
    this.setData({ previewAvatar: src })
  },

  // 关闭头像预览
  onClosePreview() {
    this.setData({ previewAvatar: '' })
  },

  // 打开行程攻略文档
  onOpenDoc() {
    wx.setClipboardData({
      data: 'https://www.kdocs.cn/l/cav0OdpEAuAE',
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '文档链接已复制到剪贴板，请退出小程序后在微信对话框粘贴打开',
          showCancel: false
        })
      }
    })
  },

  // 预览行程照片
  onPreviewTripPhoto(e) {
    const { photos, index } = e.currentTarget.dataset
    const urls = photos.map(p => p.image_url)
    wx.previewImage({
      current: urls[index],
      urls
    })
  },

  // 查看全部照片
  onViewAllPhotos(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/photos/index?tripId=${id}` })
  },

  // 查看费用明细
  onViewCost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/cost/index?tripId=${id}` })
  },

  // 编辑注意事项
  onEditNotice(e) {
    const tripId = e.currentTarget.dataset.id
    const note = e.currentTarget.dataset.note || ''
    wx.showModal({
      title: '注意事项',
      editable: true,
      placeholderText: '带好身份证、充电器、换洗衣物...',
      content: note,
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/trips/${tripId}/`,
            method: 'PATCH',
            data: { note: res.content }
          }).then(() => {
            wx.showToast({ title: '已保存', icon: 'success' })
            this.loadTrips()
          })
        }
      }
    })
  },

  // 选择昵称
  onPickNickname(e) {
    const nickname = e.currentTarget.dataset.name
    app.request({
      url: '/auth/nickname/',
      method: 'POST',
      data: { nickname }
    }).then(() => {
      // 更新本地存储
      const userInfo = app.globalData.userInfo || {}
      userInfo.nickname = nickname
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ showNicknamePicker: false })
      wx.showToast({ title: `你好，${nickname}！`, icon: 'none' })
    }).catch(() => {
      wx.showToast({ title: '设置失败', icon: 'none' })
    })
  },

  // 加载首页评论（取第一个行程的）
  loadComments() {
    const trips = this.data.trips
    if (trips.length > 0) {
      app.request({
        url: `/comments/?trip_id=${trips[0].id}`
      }).then(data => {
        this.setData({ comments: data.results || data })
      })
    }
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  onReplyComment(e) {
    const name = e.currentTarget.dataset.name
    if (name) {
      this.setData({ commentText: `@${name} ` })
    }
  },

  // 长按删除自己的评论
  onDeleteComment(e) {
    const commentId = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '删除这条评论？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/comments/${commentId}/`,
            method: 'DELETE'
          }).then(() => {
            this.loadComments()
          }).catch(() => {
            wx.showToast({ title: '只能删除自己的评论', icon: 'none' })
          })
        }
      }
    })
  },

  onSendComment() {
    const content = this.data.commentText.trim()
    if (!content) return
    const trips = this.data.trips
    if (trips.length === 0) return
    app.request({
      url: '/comments/',
      method: 'POST',
      data: { trip: trips[0].id, content }
    }).then(() => {
      this.setData({ commentText: '' })
      this.loadComments()
    }).catch(() => {
      wx.showToast({ title: '发送失败', icon: 'none' })
    })
  }
})
