const app = getApp()

Page({
  data: {
    tripId: null,
    trip: {},
    comments: [],
    commentText: '',
    showInviteModal: false,
    inviteQrCodeUrl: '',
    detailTab: 'summary', // 'summary' (行程简介) | 'detail' (行程详情 Day1, Day2)
    statusBarHeight: 20,
    navHeight: 44,
    userInfo: null,
    isCreator: false
  },

  onLoad(options) {
    try {
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = systemInfo.statusBarHeight || 20
      const navHeight = menuButton ? (menuButton.top - statusBarHeight) * 2 + menuButton.height : 44
      this.setData({
        tripId: options.id,
        statusBarHeight,
        navHeight
      })
    } catch (e) {
      this.setData({ tripId: options.id, statusBarHeight: 20, navHeight: 44 })
    }
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo })
    // 如果数据已加载且没有标记需要刷新，跳过重新加载（避免返回时闪烁）
    if (this.data.trip && this.data.trip.id && !this.needRefresh) {
      return
    }
    this.needRefresh = false
    this.loadTrip()
    this.loadComments()
  },

  // 标记需要刷新（从编辑页返回时调用）
  markNeedRefresh() {
    this.needRefresh = true
  },

  onDetailTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ detailTab: tab })
  },

  onNavBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 阻止事件冒泡
  stopBubble() {},

  loadTrip() {
    app.request({
      url: `/trips/${this.data.tripId}/`
    }).then(data => {
      const currentUser = app.globalData.userInfo
      const creatorId = typeof data.created_by === 'object' ? data.created_by.id : data.created_by
      const isCreator = Boolean(currentUser && creatorId === currentUser.id)

      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

      if (data.days) {
        let targetDayIndex = data.days.findIndex(day => day.date === todayStr)
        if (targetDayIndex === -1) {
          targetDayIndex = data.days.findIndex(day => day.date === tomorrowStr)
        }
        if (targetDayIndex === -1) {
          targetDayIndex = 0
        }

        // 保留当前的展开状态
        const currentDays = this.data.trip && this.data.trip.days
        const expandedMap = {}
        if (currentDays) {
          currentDays.forEach(d => { expandedMap[d.id] = d.expanded })
        }

        data.days.forEach((day, index) => {
          // 优先保留已有状态，否则默认展开目标日
          if (expandedMap[day.id] !== undefined) {
            day.expanded = expandedMap[day.id]
          } else {
            day.expanded = (index === targetDayIndex)
          }

          if (day.places) {
            day.places.forEach(place => {
              if (place.start_time && place.end_time) {
                place.duration = this.calcDuration(place.start_time, place.end_time)
              }
            })
          }
        })
      }
      const isCompleted = data.status === 'completed' || (data.end_date && new Date(data.end_date) < new Date(todayStr))
      this.setData({ trip: data, isCreator, isCompleted })
      // 加载天气数据并合并到地点中
      this.loadWeather()
    }).catch(err => {
      console.error('加载行程失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 跳转到旅行回忆页面
  onGoToMemory() {
    const id = this.data.tripId
    if (id) {
      wx.navigateTo({
        url: `/pages/memory/index?tripId=${id}&id=${id}`
      })
    }
  },

  // 成员点击：其他人直接看大图，自己/创建者弹出功能菜单
  onMemberClick(e) {
    const member = e.currentTarget.dataset.member
    const index = e.currentTarget.dataset.index
    const currentUser = app.globalData.userInfo
    const isSelf = currentUser && (currentUser.id === member.id || currentUser.nickname === member.nickname)
    const isCreator = this.data.isCreator

    // 点击其他人（且非创建者）：无需中间菜单，直接全屏查看大图！
    if (!isSelf && !isCreator) {
      this.previewAvatar(member)
      return
    }

    const actions = ['查看大图']

    if (isSelf) {
      actions.push('修改职责')
      actions.push('更换头像')
    } else if (isCreator) {
      actions.push('修改职责')
      actions.push('移除队员')
    }

    if (isCreator && this.data.trip.trip_members && this.data.trip.trip_members.length > 1) {
      if (index > 0) actions.push('向前前移')
      if (index < this.data.trip.trip_members.length - 1) actions.push('向后后移')
    }

    wx.showActionSheet({
      itemList: actions,
      success: (res) => {
        const act = actions[res.tapIndex]
        if (act === '查看大图') {
          this.previewAvatar(member)
        } else if (act === '修改职责') {
          this.editMemberRole(member, isSelf)
        } else if (act === '更换头像') {
          this.uploadAvatar()
        } else if (act === '移除队员') {
          this.removeMember(member)
        } else if (act === '向前前移') {
          this.moveMember(index, -1)
        } else if (act === '向后后移') {
          this.moveMember(index, 1)
        }
      }
    })
  },

  // 移除行程成员（仅发起人）
  removeMember(member) {
    if (!member) return
    wx.showModal({
      title: '提示',
      content: `确定要将队员【${member.nickname || '队友'}】移出此行程吗？`,
      confirmColor: '#e57373',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          app.request({
            url: `/trips/${this.data.tripId}/remove_member/`,
            method: 'POST',
            data: { member_id: member.id }
          }).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已移除队员', icon: 'success' })
            this.loadTrip()
          }).catch(err => {
            wx.hideLoading()
            const msg = err.data && err.data.error ? err.data.error : '移除失败'
            wx.showToast({ title: msg, icon: 'none' })
          })
        }
      }
    })
  },

  previewAvatar(member) {
    if (!member) return
    let avatarUrl = member.avatar_url
    if (!avatarUrl) {
      if (member.nickname === '潮唧唧') avatarUrl = '/images/1_jiji.jpg'
      else if (member.nickname === '飞机') avatarUrl = '/images/2_feiji.jpg'
      else if (member.nickname === '宝哥') avatarUrl = '/images/3_baoge.jpg'
      else if (member.nickname === '平胸') avatarUrl = '/images/4_pingxion.jpg'
      else avatarUrl = '/images/default-avatar.jpg'
    } else if (avatarUrl.startsWith('/media/')) {
      const host = app.globalData.baseUrl.replace('/api/v1', '')
      avatarUrl = `${host}${avatarUrl}`
    }
    this.setData({ previewAvatarUrl: avatarUrl })
  },

  closeAvatarPreview() {
    this.setData({ previewAvatarUrl: '' })
  },

  uploadAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '上传中...' })
        app.uploadFile({
          url: '/auth/profile/',
          filePath,
          name: 'avatar'
        }).then((data) => {
          wx.hideLoading()
          wx.showToast({ title: '头像已更新', icon: 'success' })
          if (data && data.avatar_url && app.globalData.userInfo) {
            app.globalData.userInfo.avatar_url = data.avatar_url
            wx.setStorageSync('userInfo', app.globalData.userInfo)
          }
          this.loadTrip()
        }).catch((err) => {
          wx.hideLoading()
          console.error('上传头像失败', err)
          wx.showToast({ title: '上传失败', icon: 'none' })
        })
      }
    })
  },

  // 修改成员职责
  editMemberRole(member, isSelf) {
    wx.showModal({
      title: isSelf ? '修改我的职责' : `修改【${member.nickname || '队友'}】的职责`,
      editable: true,
      placeholderText: member.role || '留空为无职责，如：司机、导游、摄影、财务...',
      success: (res) => {
        if (res.confirm) {
          const newRole = res.content ? res.content.trim() : ''
          const url = isSelf ? '/auth/profile/' : `/auth/members/${member.id}/`
          app.request({
            url,
            method: 'POST',
            data: { role: newRole, trip_id: this.data.tripId }
          }).then(() => {
            wx.showToast({ title: '已更新职责', icon: 'success' })
            // 局部更新成员 role，不重新加载避免排序重置
            const trip = this.data.trip
            if (trip && trip.trip_members) {
              trip.trip_members.forEach(m => {
                if (m.id === member.id) m.role = newRole
              })
              this.setData({ trip })
            }
          }).catch(() => {
            wx.showToast({ title: '更新失败', icon: 'none' })
          })
        }
      }
    })
  },

  // 清除/删除职责
  clearMemberRole(member, isSelf) {
    const url = isSelf ? '/auth/profile/' : `/auth/members/${member.id}/`
    app.request({
      url,
      method: 'POST',
      data: { role: '', trip_id: this.data.tripId }
    }).then(() => {
      wx.showToast({ title: '已删除职责', icon: 'success' })
      // 局部更新
      const trip = this.data.trip
      if (trip && trip.trip_members) {
        trip.trip_members.forEach(m => {
          if (m.id === member.id) m.role = ''
        })
        this.setData({ trip })
      }
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  // 行程概览卡片向右滑动 (露出编辑与删除按钮)
  onOverviewTouchStart(e) {
    if (!this.data.isCreator) return
    this.overviewStartX = e.touches[0].clientX
    this.overviewBaseX = this.data.overviewSwipeX || 0
  },

  onOverviewTouchMove(e) {
    if (!this.data.isCreator || this.overviewStartX === undefined) return
    const deltaX = e.touches[0].clientX - this.overviewStartX
    const newX = this.overviewBaseX + deltaX
    // 限制在 0~140 范围
    const clampedX = Math.max(0, Math.min(140, newX))
    this.setData({ overviewSwipeX: clampedX })
  },

  onOverviewTouchEnd() {
    if (!this.data.isCreator) return
    const currentX = this.data.overviewSwipeX || 0
    if (currentX > 50) {
      this.setData({ overviewSwipeX: 140 })
    } else {
      this.setData({ overviewSwipeX: 0 })
    }
    this.overviewStartX = undefined
    this.overviewBaseX = undefined
  },

  // 拖动排序成员头像（发起人专属）
  onAvatarTouchStart(e) {
    if (!this.data.isCreator) return
    const index = e.currentTarget.dataset.index
    this.dragStartIndex = index
    this.currentDragIndex = index
    this.dragStartX = e.touches[0].clientX
    this.setData({ draggingIndex: index })
  },

  onAvatarTouchMove(e) {
    if (!this.data.isCreator || this.dragStartIndex === undefined) return
    const currentX = e.touches[0].clientX
    const deltaX = currentX - this.dragStartX
    const moveOffset = Math.round(deltaX / 50)
    let targetIndex = this.dragStartIndex + moveOffset
    const members = this.data.trip.trip_members
    if (!members || members.length <= 1) return

    if (targetIndex < 0) targetIndex = 0
    if (targetIndex >= members.length) targetIndex = members.length - 1

    if (targetIndex !== this.currentDragIndex) {
      const temp = members[this.currentDragIndex]
      members[this.currentDragIndex] = members[targetIndex]
      members[targetIndex] = temp
      this.currentDragIndex = targetIndex
      this.setData({ 
        'trip.trip_members': members,
        draggingIndex: targetIndex
      })
    }
  },

  onAvatarTouchEnd() {
    if (!this.data.isCreator) return
    if (this.dragStartIndex !== undefined && this.dragStartIndex !== this.currentDragIndex) {
      this.saveMemberOrder(this.data.trip.trip_members)
      wx.showToast({ title: '已更新顺序', icon: 'success' })
    }
    this.dragStartIndex = undefined
    this.currentDragIndex = undefined
    this.setData({ draggingIndex: -1 })
  },

  saveMemberOrder(members) {
    if (!members) return
    const order = members.map(m => m.id)
    app.request({
      url: `/trips/${this.data.tripId}/`,
      method: 'PATCH',
      data: { member_order: order }
    }).catch(err => {
      console.error('保存成员顺序失败', err)
    })
  },

  // 移动成员顺序
  moveMember(index, direction) {
    const members = this.data.trip.trip_members
    if (!members) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= members.length) return

    const temp = members[index]
    members[index] = members[targetIndex]
    members[targetIndex] = temp

    this.setData({ 'trip.trip_members': members })
    this.saveMemberOrder(members)
    wx.showToast({ title: '已调整排列顺序', icon: 'success' })
  },

  // 切换天数折叠/展开
  toggleDay(e) {
    const index = e.currentTarget.dataset.index
    const trip = this.data.trip
    if (trip && trip.days && trip.days[index]) {
      trip.days[index].expanded = !trip.days[index].expanded
      this.setData({ trip })
    }
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
    this.needRefresh = true
    wx.navigateTo({ url: `/pages/trip/edit?id=${this.data.tripId}` })
  },

  // 费用汇总
  onCostSummary() {
    wx.navigateTo({ url: `/pages/cost/index?tripId=${this.data.tripId}` })
  },

  // 查看照片相册
  onViewPhotos() {
    wx.navigateTo({ url: `/pages/photos/index?tripId=${this.data.tripId}` })
  },

  // 邀请分享
  onShareTrip() {
    this.setData({ showInviteModal: true })
    app.request({
      url: `/trips/${this.data.tripId}/invite/`
    }).then(res => {
      this.setData({ inviteQrCodeUrl: res.qr_base64 })
    }).catch(err => {
      wx.showToast({ title: '生成邀请码失败', icon: 'none' })
      this.setData({ showInviteModal: false })
    })
  },

  onCloseInvite() {
    this.setData({ showInviteModal: false, inviteQrCodeUrl: '' })
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
          }).catch(() => {
            wx.showToast({ title: '删除失败', icon: 'none' })
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

  // 编辑打卡地点
  onEditPlace(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      this.needRefresh = true
      wx.navigateTo({ url: `/pages/place/edit?id=${id}` })
    }
  },

  // 删除打卡地点
  onDeletePlace(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '提示',
      content: '确定要删除这个打卡地点吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          app.request({
            url: `/places/${id}/`,
            method: 'DELETE'
          }).then(() => {
            wx.hideLoading()
            wx.showToast({ title: '已删除打卡点', icon: 'success' })
            this.loadTrip()
          }).catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  // 打卡地点卡片向右滑动 (露出编辑与删除按钮)
  onPlaceTouchStart(e) {
    if (!this.data.isCreator) return
    const dayIndex = e.currentTarget.dataset.dayIndex
    const placeIndex = e.currentTarget.dataset.placeIndex
    this.placeStartX = e.touches[0].clientX
    this.currentPlaceDayIndex = dayIndex
    this.currentPlaceIndex = placeIndex
    // 记录当前位置作为基准
    const trip = this.data.trip
    this.placeBaseX = (trip && trip.days && trip.days[dayIndex] && trip.days[dayIndex].places && trip.days[dayIndex].places[placeIndex]) ? (trip.days[dayIndex].places[placeIndex].swipeX || 0) : 0
  },

  onPlaceTouchMove(e) {
    if (!this.data.isCreator || this.placeStartX === undefined || this.currentPlaceDayIndex === undefined) return
    const deltaX = e.touches[0].clientX - this.placeStartX
    const newX = Math.max(0, Math.min(140, (this.placeBaseX || 0) + deltaX))
    const dayIdx = this.currentPlaceDayIndex
    const placeIdx = this.currentPlaceIndex
    const path = `trip.days[${dayIdx}].places[${placeIdx}].swipeX`
    this.setData({ [path]: newX })
  },

  onPlaceTouchEnd() {
    if (!this.data.isCreator || this.currentPlaceDayIndex === undefined || this.currentPlaceIndex === undefined) return
    const dayIdx = this.currentPlaceDayIndex
    const placeIdx = this.currentPlaceIndex
    const trip = this.data.trip
    if (trip && trip.days && trip.days[dayIdx] && trip.days[dayIdx].places) {
      const currentX = trip.days[dayIdx].places[placeIdx].swipeX || 0
      const path = `trip.days[${dayIdx}].places[${placeIdx}].swipeX`
      this.setData({ [path]: currentX > 50 ? 140 : 0 })
    }
    this.placeStartX = undefined
    this.placeBaseX = undefined
    this.currentPlaceDayIndex = undefined
    this.currentPlaceIndex = undefined
  },

  // 添加地点
  onAddPlace(e) {
    const dayId = e.currentTarget.dataset.dayId
    this.needRefresh = true
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
  },

  onShareAppMessage() {
    const trip = this.data.trip || {}
    return {
      title: `邀请你加入【${trip.title || '行程'}】`,
      path: `/pages/index/index?invite_token=${this.data.tripId}`,
      imageUrl: trip.cover_image_url || ''
    }
  }
})
