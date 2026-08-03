const app = getApp()

Page({
  data: {
    tripId: null,
    trip: {},
    stats: {},
    photos: [],
    markers: [],
    members: [],
    currentSlide: 0,
    photoPageIndex: 0,
    totalPhotoPages: 0,
    currentPagePhotos: [],
    showSlideshow: false,
    mapCenter: { latitude: 30, longitude: 114 },
    mapMarkers: [],
    polyline: [],
    mapScale: 5,
    totalDistance: 0
  },

  onLoad(options) {
    const tripId = options.tripId || options.id
    this.setData({ tripId })
    this.loadMemoryData()
  },

  loadMemoryData() {
    app.request({
      url: `/trips/${this.data.tripId}/memory/`
    }).then(data => {
      this.setData({
        trip: data.trip,
        stats: data.stats,
        photos: data.photos,
        markers: data.markers,
        routeNodes: data.route_nodes || [],
        members: data.members
      })
      this.setupPhotoPages()
      this.setupMap(data.markers)
    }).catch(err => {
      console.error('加载回忆数据失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 设置地图标记和连线
  setupMap(markers) {
    if (!markers || markers.length === 0) return

    // 计算总里程（公里）
    let totalDistance = 0
    for (let i = 1; i < markers.length; i++) {
      totalDistance += this.calcDistance(
        markers[i - 1].latitude, markers[i - 1].longitude,
        markers[i].latitude, markers[i].longitude
      )
    }

    // 地图标记点（蓝色定位图标，与足迹页一致）
    const mapMarkers = markers.map((m, i) => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.city,
      iconPath: '/images/marker-pin.png',
      width: 24,
      height: 24,
      callout: {
        content: m.city,
        padding: 4,
        borderRadius: 8,
        display: 'ALWAYS',
        fontSize: 11,
        color: '#1e293b',
        bgColor: '#ffffff'
      }
    }))

    // 蓝色粗线连接，带箭头
    const points = markers.map(m => ({
      latitude: m.latitude,
      longitude: m.longitude
    }))

    const polyline = [{
      points,
      color: '#4078F0',
      width: 5,
      dottedLine: false,
      arrowLine: true
    }]

    // 计算地图中心和缩放
    const lats = markers.map(m => m.latitude)
    const lngs = markers.map(m => m.longitude)
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

    const latSpan = Math.max(...lats) - Math.min(...lats)
    const lngSpan = Math.max(...lngs) - Math.min(...lngs)
    const maxSpan = Math.max(latSpan, lngSpan)
    let scale = 12
    if (maxSpan > 5) scale = 5
    else if (maxSpan > 2) scale = 7
    else if (maxSpan > 1) scale = 9
    else if (maxSpan > 0.5) scale = 10
    else if (maxSpan > 0.1) scale = 12

    this.setData({
      mapMarkers,
      polyline,
      mapCenter: { latitude: centerLat, longitude: centerLng },
      mapScale: scale,
      totalDistance: Math.round(totalDistance * 1.3)
    })
  },

  // 计算两点间距离（公里），Haversine 公式
  calcDistance(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180
    const dLat = (lat2 - lat1) * rad
    const dLng = (lng2 - lng1) * rad
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return 6371 * c // 地球半径 6371km
  },

  // 设置照片分页（每页9张）
  setupPhotoPages() {
    const photos = this.data.photos
    const totalPages = Math.ceil(photos.length / 9) || 1
    const currentPagePhotos = photos.slice(0, 9)
    this.setData({
      totalPhotoPages: totalPages,
      photoPageIndex: 0,
      currentPagePhotos
    })
  },

  // 上一页
  onPrevPage() {
    if (this.data.photoPageIndex <= 0) return
    const newIndex = this.data.photoPageIndex - 1
    const currentPagePhotos = this.data.photos.slice(newIndex * 9, (newIndex + 1) * 9)
    this.setData({ photoPageIndex: newIndex, currentPagePhotos })
  },

  // 下一页
  onNextPage() {
    if (this.data.photoPageIndex >= this.data.totalPhotoPages - 1) return
    const newIndex = this.data.photoPageIndex + 1
    const currentPagePhotos = this.data.photos.slice(newIndex * 9, (newIndex + 1) * 9)
    this.setData({ photoPageIndex: newIndex, currentPagePhotos })
  },

  // 开始幻灯片
  onStartSlideshow() {
    this.setData({ showSlideshow: true })
  },

  // 停止幻灯片
  onStopSlideshow() {
    this.setData({ showSlideshow: false })
  },

  // 幻灯片切换
  onSlideChange(e) {
    this.setData({ currentSlide: e.detail.current })
  },

  // 预览照片
  onPreviewPhoto(e) {
    const index = e.currentTarget.dataset.index
    const urls = this.data.photos.map(p => p.image_url)
    wx.previewImage({
      current: urls[index],
      urls
    })
  }
})
