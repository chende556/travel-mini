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
        startTime: data.start_time || '',
        endTime: data.end_time || '',
        cost: data.cost || '',
        note: data.note,
        dayPlanId: data.day_plan
      })
    })
  },

  onSelectType(e) { this.setData({ type: e.currentTarget.dataset.type }) },
  onInputName(e) { this.setData({ name: e.detail.value }) },
  onInputAddress(e) { this.setData({ address: e.detail.value }) },
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

  onClearLocation() {
    this.setData({ latitude: null, longitude: null })
  },

  onSubmit() {
    const { name, type, address, latitude, longitude, startTime, endTime, cost, note, isEdit, placeId, dayId } = this.data

    if (!name.trim()) {
      wx.showToast({ title: '请输入地点名称', icon: 'none' })
      return
    }

    const data = {
      type,
      name: name.trim(),
      address,
      latitude: latitude || null,
      longitude: longitude || null,
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
