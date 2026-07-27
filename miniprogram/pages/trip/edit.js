const app = getApp()

Page({
  data: {
    isEdit: false,
    tripId: null,
    title: '',
    destination: '',
    startDate: '',
    endDate: '',
    membersCount: '1',
    note: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, tripId: options.id })
      this.loadTrip()
    }
  },

  loadTrip() {
    app.request({
      url: `/trips/${this.data.tripId}/`
    }).then(data => {
      this.setData({
        title: data.title,
        destination: data.destination,
        startDate: data.start_date,
        endDate: data.end_date,
        membersCount: String(data.members_count || 1),
        note: data.note
      })
    })
  },

  onInputTitle(e) { this.setData({ title: e.detail.value }) },
  onInputDestination(e) { this.setData({ destination: e.detail.value }) },
  onInputMembersCount(e) { this.setData({ membersCount: e.detail.value }) },
  onInputNote(e) { this.setData({ note: e.detail.value }) },
  onStartDateChange(e) { this.setData({ startDate: e.detail.value }) },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }) },

  onSubmit() {
    const { title, destination, startDate, endDate, note, isEdit, tripId } = this.data

    if (!title.trim()) {
      wx.showToast({ title: '请输入行程名称', icon: 'none' })
      return
    }
    if (!startDate || !endDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return
    }

    const data = {
      title: title.trim(),
      destination,
      start_date: startDate,
      end_date: endDate,
      members_count: parseInt(this.data.membersCount) || 1,
      note
    }

    const url = isEdit ? `/trips/${tripId}/` : '/trips/'
    const method = isEdit ? 'PUT' : 'POST'

    app.request({ url, method, data }).then(() => {
      wx.showToast({ title: isEdit ? '修改成功' : '创建成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    }).catch(err => {
      console.error('提交失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    })
  }
})
