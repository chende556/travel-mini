const app = getApp()

Page({
  data: {
    tripId: null,
    tripTitle: '',
    days: [],
    loading: false
  },

  onLoad(options) {
    this.setData({ tripId: options.tripId })
    this.loadPhotos()
  },

  loadPhotos() {
    this.setData({ loading: true })
    app.request({
      url: `/trips/${this.data.tripId}/photos/`
    }).then(data => {
      this.setData({
        tripTitle: data.trip_title,
        days: data.days,
        loading: false
      })
    }).catch(err => {
      console.error('加载照片失败', err)
      this.setData({ loading: false })
    })
  },

  // 预览照片
  onPreview(e) {
    const place = e.currentTarget.dataset.place
    const photoIndex = e.currentTarget.dataset.photoIndex
    const urls = place.photos.map(p => p.image_url)
    wx.previewImage({
      current: urls[photoIndex],
      urls
    })
  }
})
