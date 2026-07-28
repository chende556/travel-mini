const app = getApp()

Page({
  data: {
    placeId: null,
    place: {},
    photos: [],
    comments: [],
    commentText: '',
    weather: {}
  },

  onLoad(options) {
    this.setData({ placeId: options.id })
  },

  onShow() {
    this.loadPlace()
    this.loadPhotos()
    this.loadComments()
    this.loadWeather()
  },

  loadPlace() {
    app.request({
      url: `/places/${this.data.placeId}/`
    }).then(data => {
      this.setData({ place: data })
    })
  },

  // 加载实时天气
  loadWeather() {
    app.request({
      url: `/places/${this.data.placeId}/weather/`
    }).then(data => {
      this.setData({ weather: data.weather || {} })
    }).catch(() => {})
  },

  // 编辑地点
  onEditPlace() {
    wx.navigateTo({ url: `/pages/place/edit?id=${this.data.placeId}` })
  },

  // 查看地图位置
  onOpenMap() {
    const { latitude, longitude, name, address } = this.data.place
    if (latitude && longitude) {
      wx.openLocation({
        latitude,
        longitude,
        name: name || '',
        address: address || '',
        scale: 15
      })
    }
  },

  // 删除地点
  onDeletePlace() {
    wx.showModal({
      title: '提示',
      content: '确定删除该地点？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/places/${this.data.placeId}/`,
            method: 'DELETE'
          }).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1000)
          })
        }
      }
    })
  },

  loadPhotos() {
    app.request({
      url: `/places/${this.data.placeId}/photos/`
    }).then(data => {
      this.setData({ photos: data.results || data })
    })
  },

  // 上传照片
  onUploadPhoto() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      success: (res) => {
        const files = res.tempFiles
        const uploadPromises = files.map(file => {
          return app.uploadFile({
            url: `/places/${this.data.placeId}/photos/`,
            filePath: file.tempFilePath
          })
        })

        Promise.all(uploadPromises).then(() => {
          wx.showToast({ title: '上传成功', icon: 'success' })
          this.loadPhotos()
        }).catch(err => {
          console.error('上传失败', err)
          wx.showToast({ title: '上传失败', icon: 'none' })
        })
      }
    })
  },

  // 预览照片
  onPreviewPhoto(e) {
    const index = e.currentTarget.dataset.index
    const urls = this.data.photos.map(p => p.image_url)
    wx.previewImage({
      current: urls[index],
      urls
    })
  },

  // 删除照片
  onDeletePhoto(e) {
    const photoId = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除这张照片？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/photos/${photoId}/`,
            method: 'DELETE'
          }).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadPhotos()
          })
        }
      }
    })
  },

  // 加载评论
  loadComments() {
    app.request({
      url: `/comments/?place_id=${this.data.placeId}`
    }).then(data => {
      this.setData({ comments: data.results || data })
    })
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
    app.request({
      url: '/comments/',
      method: 'POST',
      data: { place: this.data.placeId, content }
    }).then(() => {
      this.setData({ commentText: '' })
      this.loadComments()
    }).catch(() => {
      wx.showToast({ title: '发送失败', icon: 'none' })
    })
  }
})
