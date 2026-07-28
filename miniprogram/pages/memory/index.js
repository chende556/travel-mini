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
    this.setData({ tripId: options.id })
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

    // 地图标记点
    const mapMarkers = markers.map((m, i) => ({
      id: m.id,
      latitude: m.latitude,
      longitude: m.longitude,
      title: m.city,
      width: 20,
      height: 20,
      label: {
        content: m.city,
        fontSize: 12,
        color: '#fff',
        bgColor: 'rgba(64, 120, 240, 0.9)',
        padding: 5,
        borderRadius: 12,
        anchorX: 0,
        anchorY: -35
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
  },

  // 生成回忆海报
  onGeneratePoster() {
    wx.showLoading({ title: '生成中...' })

    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const width = 750
        const height = 1334
        canvas.width = width
        canvas.height = height

        this.drawPoster(ctx, canvas, width, height)
      })
  },

  drawPoster(ctx, canvas, width, height) {
    const { trip, stats, members } = this.data

    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(0.5, '#16213e')
    gradient.addColorStop(1, '#0f3460')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // 标题
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(trip.title || '我的旅行', width / 2, 120)

    // 目的地
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = '28px sans-serif'
    ctx.fillText(`📍 ${trip.destination || ''}`, width / 2, 180)

    // 日期
    ctx.fillText(`${trip.start_date} ~ ${trip.end_date}`, width / 2, 230)

    // 统计数据区域
    const statsY = 320
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(40, statsY, width - 80, 200)

    // 统计数据
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 44px sans-serif'
    ctx.textAlign = 'center'
    const statItems = [
      { value: `${stats.days}天`, x: width * 0.2 },
      { value: `${stats.places}地点`, x: width * 0.4 },
      { value: `${stats.photos}张`, x: width * 0.6 },
      { value: `¥${stats.total_cost}`, x: width * 0.8 },
    ]
    statItems.forEach(item => {
      ctx.fillText(item.value, item.x, statsY + 80)
    })

    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '24px sans-serif'
    const labels = ['行程', '打卡', '照片', '花费']
    labels.forEach((label, i) => {
      ctx.fillText(label, statItems[i].x, statsY + 130)
    })

    // 人均
    ctx.fillStyle = '#f5576c'
    ctx.font = 'bold 32px sans-serif'
    ctx.fillText(`人均 ¥${stats.per_person_cost}`, width / 2, statsY + 180)

    // 成员区域
    const memberY = 600
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 30px sans-serif'
    ctx.fillText('旅行伙伴', width / 2, memberY)

    // 绘制成员头像和名字
    const memberCount = members.length
    const avatarSize = 80
    const startX = (width - memberCount * (avatarSize + 40)) / 2

    let loadedCount = 0
    const totalToLoad = memberCount

    if (memberCount === 0) {
      this.finishPoster(canvas, ctx, width, height, memberY)
      return
    }

    members.forEach((member, i) => {
      const x = startX + i * (avatarSize + 40) + avatarSize / 2
      const y = memberY + 60

      // 画圆形边框
      ctx.beginPath()
      ctx.arc(x, y + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fill()

      // 加载头像图片
      if (member.avatar_url) {
        const img = canvas.createImage()
        img.onload = () => {
          ctx.save()
          ctx.beginPath()
          ctx.arc(x, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(img, x - avatarSize / 2, y, avatarSize, avatarSize)
          ctx.restore()

          // 名字
          ctx.fillStyle = '#fff'
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(member.nickname, x, y + avatarSize + 30)

          // 职责
          if (member.role) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)'
            ctx.font = '18px sans-serif'
            ctx.fillText(member.role, x, y + avatarSize + 58)
          }

          loadedCount++
          if (loadedCount >= totalToLoad) {
            this.finishPoster(canvas, ctx, width, height, memberY)
          }
        }
        img.onerror = () => {
          // 头像加载失败，画占位圆
          ctx.beginPath()
          ctx.arc(x, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
          ctx.fillStyle = '#667eea'
          ctx.fill()

          ctx.fillStyle = '#fff'
          ctx.font = '22px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(member.nickname, x, y + avatarSize + 30)

          loadedCount++
          if (loadedCount >= totalToLoad) {
            this.finishPoster(canvas, ctx, width, height, memberY)
          }
        }
        img.src = member.avatar_url
      } else {
        // 无头像，画占位
        ctx.beginPath()
        ctx.arc(x, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#667eea'
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = '22px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(member.nickname, x, y + avatarSize + 30)

        if (member.role) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)'
          ctx.font = '18px sans-serif'
          ctx.fillText(member.role, x, y + avatarSize + 58)
        }

        loadedCount++
        if (loadedCount >= totalToLoad) {
          this.finishPoster(canvas, ctx, width, height, memberY)
        }
      }
    })
  },

  finishPoster(canvas, ctx, width, height, memberY) {
    // 底部 slogan
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '26px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('我和青春有个约定', width / 2, height - 100)

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '22px sans-serif'
    ctx.fillText('— 用脚步丈量世界 —', width / 2, height - 60)

    // 导出图片
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvas,
        success: (res) => {
          wx.hideLoading()
          wx.previewImage({
            urls: [res.tempFilePath]
          })
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('生成海报失败', err)
          wx.showToast({ title: '生成失败', icon: 'none' })
        }
      })
    }, 500)
  }
})
