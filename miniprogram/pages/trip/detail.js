const app = getApp()

Page({
  data: {
    tripId: null,
    trip: {},
    comments: [],
    commentText: ''
  },

  onLoad(options) {
    this.setData({ tripId: options.id })
  },

  onShow() {
    this.loadTrip()
    this.loadComments()
  },

  loadTrip() {
    app.request({
      url: `/trips/${this.data.tripId}/`
    }).then(data => {
      // 计算每个地点的时长
      if (data.days) {
        data.days.forEach(day => {
          if (day.places) {
            day.places.forEach(place => {
              if (place.start_time && place.end_time) {
                place.duration = this.calcDuration(place.start_time, place.end_time)
              }
            })
          }
        })
      }
      this.setData({ trip: data })
      // 加载天气
      this.loadWeather()
    }).catch(err => {
      console.error('加载行程失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 加载行程所有地点的天气
  loadWeather() {
    app.request({
      url: `/trips/${this.data.tripId}/weather/`
    }).then(weatherMap => {
      // 把天气数据合并到 trip.days.places 里
      const trip = this.data.trip
      if (trip.days) {
        trip.days.forEach(day => {
          if (day.places) {
            day.places.forEach(place => {
              if (weatherMap[place.id]) {
                place.weather = weatherMap[place.id]
              }
            })
          }
        })
      }
      this.setData({ trip })
    }).catch(() => {})
  },

  // 计算时长
  calcDuration(start, end) {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let minutes = (eh * 60 + em) - (sh * 60 + sm)
    if (minutes <= 0) return ''
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h > 0 && m > 0) return `${h}h${m}min`
    if (h > 0) return `${h}h`
    return `${m}min`
  },

  // 编辑每日计划备注
  onEditDay(e) {
    const day = e.currentTarget.dataset.day
    wx.showModal({
      title: `Day ${day.day_number} 备注`,
      editable: true,
      placeholderText: '输入当天备注',
      content: day.note || '',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/days/${day.id}/`,
            method: 'PUT',
            data: { 
              trip: this.data.tripId,
              date: day.date,
              day_number: day.day_number,
              note: res.content 
            }
          }).then(() => {
            this.loadTrip()
          })
        }
      }
    })
  },

  // 编辑行程
  onEditTrip() {
    wx.navigateTo({ url: `/pages/trip/edit?id=${this.data.tripId}` })
  },

  // 费用汇总
  onCostSummary() {
    wx.navigateTo({ url: `/pages/cost/index?tripId=${this.data.tripId}` })
  },

  // 删除行程
  onDeleteTrip() {
    wx.showModal({
      title: '提示',
      content: '确定删除该行程？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/trips/${this.data.tripId}/`,
            method: 'DELETE'
          }).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1000)
          })
        }
      }
    })
  },

  // 查看地点详情
  onPlaceDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/place/detail?id=${id}` })
  },

  // 添加地点
  onAddPlace(e) {
    const dayId = e.currentTarget.dataset.dayId
    wx.navigateTo({ url: `/pages/place/edit?dayId=${dayId}` })
  },

  // 上移地点
  onMoveUp(e) {
    const { dayId, placeId, index } = e.currentTarget.dataset
    if (index === 0) return
    this.reorderPlace(dayId, placeId, 'up')
  },

  // 下移地点
  onMoveDown(e) {
    const { dayId, placeId, index, total } = e.currentTarget.dataset
    if (index >= total - 1) return
    this.reorderPlace(dayId, placeId, 'down')
  },

  // 调用排序接口
  reorderPlace(dayId, placeId, direction) {
    app.request({
      url: '/places/reorder/',
      method: 'POST',
      data: { place_id: placeId, direction }
    }).then(() => {
      this.loadTrip()
    }).catch(err => {
      console.error('排序失败', err)
    })
  },

  // 打开地图位置
  onOpenMap(e) {
    const { lat, lng, name, address } = e.currentTarget.dataset
    wx.openLocation({
      latitude: Number(lat),
      longitude: Number(lng),
      name: name || '',
      address: address || '',
      scale: 15
    })
  },

  // 加载评论
  loadComments() {
    app.request({
      url: `/comments/?trip_id=${this.data.tripId}`
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
      data: { trip: this.data.tripId, content }
    }).then(() => {
      this.setData({ commentText: '' })
      this.loadComments()
    }).catch(() => {
      wx.showToast({ title: '发送失败', icon: 'none' })
    })
  },

  // 生成行程海报
  onGeneratePoster() {
    wx.showLoading({ title: '生成中...' })
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      canvas.width = 750 * dpr
      canvas.height = 1200 * dpr
      ctx.scale(dpr, dpr)

      const trip = this.data.trip

      // 背景
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 750, 1200)

      // 顶部渐变条
      const gradient = ctx.createLinearGradient(0, 0, 750, 200)
      gradient.addColorStop(0, '#667eea')
      gradient.addColorStop(1, '#764ba2')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 750, 200)

      // 标题
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText(trip.title || '', 40, 80)

      // 目的地和日期
      ctx.font = '24px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(`📍 ${trip.destination || ''}`, 40, 130)
      ctx.fillText(`${trip.start_date} ~ ${trip.end_date}`, 40, 170)

      // 每日行程
      let y = 240
      ctx.fillStyle = '#333333'

      if (trip.days) {
        trip.days.forEach(day => {
          if (y > 1100) return
          // Day 标题
          ctx.font = 'bold 28px sans-serif'
          ctx.fillStyle = '#07c160'
          ctx.fillText(`Day ${day.day_number}  ${day.date}`, 40, y)
          y += 40

          // 地点列表
          ctx.font = '24px sans-serif'
          ctx.fillStyle = '#333333'
          if (day.places) {
            day.places.forEach(place => {
              if (y > 1100) return
              const icon = place.type === 'hotel' ? '🏨' : place.type === 'scenic' ? '🏞️' : place.type === 'restaurant' ? '🍽️' : place.type === 'transport' ? '🚗' : '📍'
              let text = `${icon} ${place.name}`
              if (place.start_time) text += ` ${place.start_time}`
              if (place.cost) text += ` ¥${place.cost}`
              ctx.fillText(text, 60, y)
              y += 36
            })
          }
          y += 20
        })
      }

      // 底部
      ctx.fillStyle = '#999999'
      ctx.font = '20px sans-serif'
      ctx.fillText('我和青春有个约定 🚗', 40, 1160)

      // 导出图片
      wx.canvasToTempFilePath({
        canvas,
        success: (res) => {
          wx.hideLoading()
          wx.previewImage({
            urls: [res.tempFilePath],
            success: () => {
              wx.showModal({
                title: '保存海报',
                content: '长按图片可以保存到相册',
                showCancel: false
              })
            }
          })
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '生成失败', icon: 'none' })
        }
      })
    })
  }
})
