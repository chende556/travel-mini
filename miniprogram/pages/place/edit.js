const app = getApp()

Page({
  data: {
    isEdit: false,
    placeId: null,
    dayId: null,
    type: 'scenic',
    name: '',
    address: '',
    latitude: null,
    longitude: null,
    // 路线专属字段（自驾 / 飞机 / 火车）
    startLocation: '',
    startLatitude: null,
    startLongitude: null,
    endLocation: '',
    endLatitude: null,
    endLongitude: null,
    distanceKm: null,
    startTime: '',
    endTime: '',
    cost: '',
    note: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, placeId: options.id })
      this.loadPlace()
    } else if (options.dayId) {
      this.setData({ dayId: options.dayId })
    }
  },

  loadPlace() {
    app.request({
      url: `/places/${this.data.placeId}/`
    }).then(data => {
      this.setData({
        type: data.type,
        name: data.name,
        address: data.address,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        startLocation: data.start_location || '',
        startLatitude: data.start_latitude || null,
        startLongitude: data.start_longitude || null,
        endLocation: data.end_location || '',
        endLatitude: data.end_latitude || null,
        endLongitude: data.end_longitude || null,
        distanceKm: data.distance_km || null,
        startTime: data.start_time || '',
        endTime: data.end_time || '',
        cost: data.cost || '',
        note: data.note,
        dayPlanId: data.day_plan
      })
    })
  },

  // 坐标测量千米距离公式 (自动按驾车/路网系数换算，并支持用户直接手动输入)
  calcDistanceKm(lat1, lon1, lat2, lon2, type) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null
    const R = 6371 // 地球半径 km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    let d = R * c

    // 根据交通类型换算实际路网折算系数 (驾车公路约1.32倍，高铁铁路线约1.15倍)
    if (type === 'drive' || type === 'transport') {
      d = d * 1.32
    } else if (type === 'train') {
      d = d * 1.15
    }
    return Number(d.toFixed(1))
  },

  recalcDistance() {
    const { startLatitude, startLongitude, endLatitude, endLongitude, type } = this.data
    const km = this.calcDistanceKm(startLatitude, startLongitude, endLatitude, endLongitude, type)
    if (km !== null) {
      this.setData({ distanceKm: km })
    }
  },

  onInputDistanceKm(e) {
    this.setData({ distanceKm: e.detail.value })
  },

  matchCityCoord(text) {
    if (!text) return null
    const CITY_COORDS = {
      "北京": [39.9042, 116.4074], "上海": [31.2304, 121.4737], "广州": [23.1291, 113.2644],
      "深圳": [22.5431, 114.0579], "成都": [30.5728, 104.0668], "杭州": [30.2741, 120.1551],
      "重庆": [29.5630, 106.5516], "武汉": [30.5928, 114.3055], "西安": [34.3416, 108.9398],
      "苏州": [31.2989, 120.5853], "天津": [39.0842, 117.2009], "南京": [32.0603, 118.7969],
      "长沙": [28.2282, 112.9388], "郑州": [34.7466, 113.6253], "青岛": [36.0671, 120.3826],
      "沈阳": [41.8357, 123.4328], "宁波": [29.8683, 121.5440], "昆明": [24.8801, 102.8329],
      "合肥": [31.8612, 117.2830], "哈尔滨": [45.8038, 126.5349], "福州": [26.0745, 119.2965],
      "厦门": [24.4798, 118.0894], "济南": [36.6512, 117.1201], "太原": [37.8706, 112.5489],
      "南昌": [28.6829, 115.8582], "贵阳": [26.6470, 106.6302], "南宁": [22.8170, 108.3665],
      "海口": [20.0174, 110.3492], "乌鲁木齐": [43.8256, 87.6168], "兰州": [36.0611, 103.8343],
      "银川": [38.4872, 106.2309], "西宁": [36.6232, 101.7782], "拉萨": [29.6525, 91.1721],
      "三亚": [18.2528, 109.5119], "桂林": [25.2736, 110.2902], "衡阳": [26.8933, 112.6077],
      "渭南": [34.4994, 109.5097], "许昌": [34.0355, 113.8526], "宜昌": [30.6920, 111.2865],
      "咸宁": [29.8413, 114.3224], "华山": [34.4842, 110.0858]
    }
    for (const city of Object.keys(CITY_COORDS)) {
      if (text.includes(city)) {
        return CITY_COORDS[city]
      }
    }
    return null
  },

  onSelectType(e) { this.setData({ type: e.currentTarget.dataset.type }) },
  onInputName(e) { this.setData({ name: e.detail.value }) },
  onInputAddress(e) { this.setData({ address: e.detail.value }) },
  
  onInputStartLocation(e) {
    const val = e.detail.value
    const update = { startLocation: val }
    const coord = this.matchCityCoord(val)
    if (coord) {
      update.startLatitude = coord[0]
      update.startLongitude = coord[1]
    }
    this.setData(update, () => this.recalcDistance())
  },

  onInputEndLocation(e) {
    const val = e.detail.value
    const update = { endLocation: val }
    const coord = this.matchCityCoord(val)
    if (coord) {
      update.endLatitude = coord[0]
      update.endLongitude = coord[1]
    }
    this.setData(update, () => this.recalcDistance())
  },

  onInputCost(e) { this.setData({ cost: e.detail.value }) },
  onInputNote(e) { this.setData({ note: e.detail.value }) },
  onStartTimeChange(e) { this.setData({ startTime: e.detail.value }) },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }) },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.address || this.data.address
        })
      }
    })
  },

  onChooseStartLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          startLatitude: res.latitude,
          startLongitude: res.longitude,
          startLocation: res.name || res.address || this.data.startLocation
        }, () => {
          this.recalcDistance()
        })
      },
      fail: (err) => {
        console.warn('选择出发地提示', err)
      }
    })
  },

  onChooseEndLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          endLatitude: res.latitude,
          endLongitude: res.longitude,
          endLocation: res.name || res.address || this.data.endLocation
        }, () => {
          this.recalcDistance()
        })
      },
      fail: (err) => {
        console.warn('选择目的地提示', err)
      }
    })
  },

  onClearLocation() {
    this.setData({ latitude: null, longitude: null })
  },

  onSubmit() {
    const { name, type, address, latitude, longitude, startLocation, startLatitude, startLongitude, endLocation, endLatitude, endLongitude, distanceKm, startTime, endTime, cost, note, isEdit, placeId, dayId } = this.data

    let placeName = name.trim()
    if (!placeName && (type === 'drive' || type === 'flight' || type === 'train')) {
      placeName = startLocation && endLocation ? `${startLocation} -> ${endLocation}` : (startLocation || endLocation || '交通行程')
    }

    if (!placeName) {
      wx.showToast({ title: '请输入地点或行程名称', icon: 'none' })
      return
    }

    const data = {
      type,
      name: placeName,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      start_location: startLocation,
      start_latitude: startLatitude || null,
      start_longitude: startLongitude || null,
      end_location: endLocation,
      end_latitude: endLatitude || null,
      end_longitude: endLongitude || null,
      distance_km: distanceKm || null,
      start_time: startTime || null,
      end_time: endTime || null,
      cost: cost || null,
      note
    }

    let url, method
    if (isEdit) {
      url = `/places/${placeId}/`
      method = 'PUT'
      data.day_plan = this.data.dayPlanId
    } else {
      url = `/days/${dayId}/places/`
      method = 'POST'
    }

    app.request({ url, method, data }).then(() => {
      wx.showToast({ title: isEdit ? '修改成功' : '添加成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    }).catch(err => {
      console.error('提交失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    })
  }
})
