const app = getApp()

Page({
  data: {
    tripId: null,
    tripTitle: '',
    totalCost: 0,
    perPersonCost: 0,
    membersCount: 1,
    categories: [],
    loading: false
  },

  onLoad(options) {
    this.setData({ tripId: options.tripId })
    this.loadCostSummary()
  },

  loadCostSummary() {
    this.setData({ loading: true })
    app.request({
      url: `/trips/${this.data.tripId}/cost-summary/`
    }).then(data => {
      this.setData({
        tripTitle: data.trip_title,
        totalCost: data.total_cost,
        perPersonCost: data.per_person_cost,
        membersCount: data.members_count,
        categories: data.categories,
        loading: false
      })
    }).catch(err => {
      console.error('加载费用失败', err)
      this.setData({ loading: false })
    })
  }
})
