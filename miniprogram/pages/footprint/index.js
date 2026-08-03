const app = getApp()

Page({
  data: {
    userInfo: null,
    stats: {
      provinces_count: 0,
      cities_count: 0,
      places_count: 0,
      trips_count: 0,
      total_days_count: 0,
      provinces_list: [],
      cities_list: [],
      markers: []
    },
    activeTab: 'been', // 'been' | 'want' | 'light'
    activeMarkers: [],
    mapLat: 34.3416,
    mapLng: 108.9398,
    mapScale: 5,
    showCitiesSheet: false,
    loading: false
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
    this.setData({ userInfo: app.globalData.userInfo })
    this.loadFootprint()
  },

  onPullDownRefresh() {
    this.loadFootprint().then(() => wx.stopPullDownRefresh())
  },

  loadFootprint() {
    this.setData({ loading: true })
    return app.request({
      url: '/trips/footprint/'
    }).then(data => {
      let lat = 34.3416
      let lng = 108.9398
      const markers = data.markers || []
      if (markers.length > 0) {
        lat = markers[0].latitude
        lng = markers[0].longitude
      }

      this.setData({
        stats: data,
        mapLat: lat,
        mapLng: lng,
        loading: false
      }, () => {
        this.updateActiveMarkers(data)
      })
    }).catch(err => {
      console.error('加载足迹失败', err)
      this.setData({ loading: false })
    })
  },

  // 切换顶部 [已去] [待去] [点亮] 胶囊
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab }, () => {
      this.updateActiveMarkers()
    })
  },

  // 根据当前 selected tab 动态刷新地图 markers (使用精致小巧的用户头像替换红针)
  updateActiveMarkers(customData) {
    const stats = customData || this.data.stats || {}
    const { activeTab } = this.data
    let rawMarkers = []
    if (activeTab === 'been') {
      rawMarkers = (stats.been_markers && stats.been_markers.length > 0) ? stats.been_markers : (stats.markers || [])
    } else if (activeTab === 'want') {
      rawMarkers = (stats.want_markers && stats.want_markers.length > 0) ? stats.want_markers : (stats.markers || [])
    } else {
      rawMarkers = stats.light_markers || stats.markers || []
    }

    const markers = (rawMarkers || []).map((m, idx) => ({
      id: Number(m.id || idx + 1),
      latitude: Number(m.latitude || 34.3416),
      longitude: Number(m.longitude || 108.9398),
      title: m.title || '',
      iconPath: '/images/marker-pin.png',
      width: 24,
      height: 24,
      callout: {
        content: m.title || '',
        padding: 4,
        borderRadius: 8,
        display: 'ALWAYS',
        fontSize: 11,
        color: '#1e293b',
        bgColor: '#ffffff'
      }
    }))

    this.setData({ activeMarkers: markers })

    // 重新校准地图视野边界 (确保仅当包含合法坐标时触发)
    if (markers && markers.length > 0) {
      setTimeout(() => {
        try {
          const validPoints = markers
            .filter(m => typeof m.latitude === 'number' && !isNaN(m.latitude) && typeof m.longitude === 'number' && !isNaN(m.longitude))
            .map(m => ({ latitude: m.latitude, longitude: m.longitude }))
          
          if (validPoints.length > 0) {
            const mapCtx = wx.createMapContext('footprintMap', this)
            mapCtx.includePoints({
              padding: [120, 50, 120, 50],
              points: validPoints
            })
          }
        } catch (e) {
          console.warn('includePoints 提示', e)
        }
      }, 100)
    }
  },

  // 点击右侧工具栏 - 重新定位居中
  onResetCenter() {
    const { activeMarkers } = this.data
    if (activeMarkers && activeMarkers.length > 0) {
      const mapCtx = wx.createMapContext('footprintMap', this)
      mapCtx.includePoints({
        padding: [100, 40, 120, 40],
        points: activeMarkers.map(m => ({ latitude: m.latitude, longitude: m.longitude }))
      })
      wx.showToast({ title: '已重新对齐视角', icon: 'none' })
    } else {
      wx.showToast({ title: '暂无地点标注', icon: 'none' })
    }
  },

  // 展开已解锁城市清单抽屉
  onShowUnlockedCities() {
    this.setData({ showCitiesSheet: true })
  },

  // 关闭城市清单抽屉
  onCloseCitiesSheet() {
    this.setData({ showCitiesSheet: false })
  },

  // 快捷分享足迹
  onShareFootprint() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    wx.showToast({ title: '快点击右上角···分享足迹吧', icon: 'none' })
  },

  // 底部快捷新建行程按钮 (+)
  onQuickAddTrip() {
    wx.navigateTo({
      url: '/pages/trip/edit'
    })
  },

  stopBubble() {}
})
