const app = getApp()

Page({
  data: {
    tripId: null,
    tripTitle: '',
    days: [],
    trips: [],
    loading: false
  },

  onLoad(options) {
    if (options && options.tripId) {
      this.setData({ tripId: options.tripId })
    }
  },

  onShow() {
    this.loadPhotos()
  },

  loadPhotos() {
    this.setData({ loading: true })
    if (this.data.tripId) {
      // 来自特定行程
      app.request({
        url: `/trips/${this.data.tripId}/photos/`
      }).then(data => {
        this.setData({
          tripTitle: data.trip_title,
          days: data.days,
          trips: [],
          loading: false
        })
      }).catch(err => {
        console.error('加载照片失败', err)
        this.setData({ loading: false })
      })
    } else {
      // 底部 TabBar: 加载所有行程照片
      app.request({
        url: '/photos/all/'
      }).then(data => {
        this.setData({
          trips: data || [],
          loading: false
        })
      }).catch(err => {
        console.error('加载全量照片失败', err)
        this.setData({ loading: false })
      })
    }
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
