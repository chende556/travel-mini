const app = getApp()

Page({
  data: {
    userInfo: null,
    moments: [],
    loading: false,
    showPublishModal: false,
    pubContent: '',
    pubImages: [],
    pubLocation: '',
    pubTripId: null,
    pubTripTitle: '',
    myTrips: [],
    submitting: false,
    activeCommentId: null,
    commentText: ''
  },

  stopBubble() {},

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
    this.setData({ userInfo: app.globalData.userInfo })
    this.loadMoments()
    this.loadMyTrips()
  },

  loadMyTrips() {
    app.request({ url: '/trips/' }).then(data => {
      const trips = data.results || data || []
      this.setData({ myTrips: trips })
    }).catch(() => {})
  },

  onPullDownRefresh() {
    this.loadMoments().then(() => wx.stopPullDownRefresh())
  },

  loadMoments() {
    this.setData({ loading: true })
    return app.request({
      url: '/moments/'
    }).then(data => {
      const list = data.results || data || []
      list.forEach(item => {
        if (item.liked_nicknames && item.liked_nicknames.length > 0) {
          item.liked_nicknames_str = item.liked_nicknames.join('、')
        }
        if (item.created_at) {
          item.created_at_fmt = item.created_at.replace('T', ' ').substring(0, 16)
        }
      })
      this.setData({ moments: list, loading: false })
    }).catch(err => {
      console.error('加载动态失败', err)
      this.setData({ loading: false })
    })
  },

  onOpenPublish() {
    this.setData({
      showPublishModal: true,
      pubContent: '',
      pubImages: [],
      pubLocation: ''
    })
  },

  onPublishContentInput(e) {
    this.setData({ pubContent: e.detail.value })
  },

  onChoosePubImage() {
    const remain = 9 - this.data.pubImages.length
    if (remain <= 0) return

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      success: (res) => {
        const files = res.tempFiles
        wx.showLoading({ title: '上传图片中...' })
        let uploadPromises = files.map(f => {
          return app.uploadFile({
            url: '/auth/upload/',
            filePath: f.tempFilePath,
            name: 'image'
          }).then(uploadRes => uploadRes.url)
        })

        Promise.all(uploadPromises).then(urls => {
          wx.hideLoading()
          this.setData({ pubImages: [...this.data.pubImages, ...urls] })
        }).catch(() => {
          wx.hideLoading()
          wx.showToast({ title: '部分图片上传失败', icon: 'none' })
        })
      }
    })
  },

  onRemovePubImage(e) {
    const idx = e.currentTarget.dataset.index
    const pubImages = [...this.data.pubImages]
    pubImages.splice(idx, 1)
    this.setData({ pubImages })
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ pubLocation: res.name || res.address })
      }
    })
  },

  onChooseVisibility() {
    const trips = this.data.myTrips
    if (!trips || trips.length === 0) {
      wx.showToast({ title: '暂无行程', icon: 'none' })
      return
    }
    const names = ['所有队友可见', ...trips.map(t => t.title)]
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ pubTripId: null, pubTripTitle: '' })
        } else {
          const trip = trips[res.tapIndex - 1]
          this.setData({ pubTripId: trip.id, pubTripTitle: trip.title + ' 可见' })
        }
      }
    })
  },

  onClosePublish() {
    this.setData({
      showPublishModal: false,
      editingMomentId: null,
      pubContent: '',
      pubImages: [],
      pubLocation: '',
      pubTripId: null,
      pubTripTitle: ''
    })
  },

  onEditMoment(e) {
    const moment = e.currentTarget.dataset.moment
    if (!moment) return
    this.setData({
      editingMomentId: moment.id,
      pubContent: moment.content || '',
      pubImages: moment.images || [],
      pubLocation: moment.location || '',
      showPublishModal: true
    })
  },

  onDeleteMoment(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '提示',
      content: '确定要删除这条游记动态吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          app.request({
            url: `/moments/${id}/`,
            method: 'DELETE'
          }).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadMoments()
          }).catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  onSubmitPublish() {
    if (!this.data.pubContent.trim() && this.data.pubImages.length === 0) {
      wx.showToast({ title: '请输入文字或上传照片', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    const method = this.data.editingMomentId ? 'PUT' : 'POST'
    const url = this.data.editingMomentId ? `/moments/${this.data.editingMomentId}/` : '/moments/'

    app.request({
      url,
      method,
      data: {
        content: this.data.pubContent.trim(),
        images: this.data.pubImages,
        location: this.data.pubLocation,
        trip: this.data.pubTripId || null
      }
    }).then(() => {
      wx.showToast({ title: this.data.editingMomentId ? '已保存修改' : '发布成功', icon: 'success' })
      this.setData({
        showPublishModal: false,
        submitting: false,
        editingMomentId: null,
        pubContent: '',
        pubImages: [],
        pubLocation: ''
      })
      this.loadMoments()
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'none' })
      this.setData({ submitting: false })
    })
  },

  onPreviewImage(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({
      current,
      urls
    })
  },

  onToggleLike(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    app.request({
      url: `/moments/${id}/like/`,
      method: 'POST'
    }).then(res => {
      const moments = [...this.data.moments]
      moments[index].is_liked = res.is_liked
      moments[index].likes_count = res.likes_count
      moments[index].liked_nicknames = res.liked_nicknames
      moments[index].liked_nicknames_str = res.liked_nicknames ? res.liked_nicknames.join('、') : ''
      this.setData({ moments })
    })
  },

  onFocusComment(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      activeCommentId: this.data.activeCommentId === id ? null : id,
      commentText: ''
    })
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  onSubmitComment(e) {
    const id = e.currentTarget.dataset.id
    const content = this.data.commentText.trim()
    if (!content) return

    app.request({
      url: `/moments/${id}/comment/`,
      method: 'POST',
      data: { content }
    }).then(res => {
      this.setData({ activeCommentId: null, commentText: '' })
      this.loadMoments()
    })
  }
})
