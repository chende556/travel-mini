const app = getApp()

Page({
  data: {
    isLogin: false,
    allTrips: [],
    trips: [],
    members: [],
    loading: false,
    previewAvatar: '',
    tempAvatarUrl: '',
    tempNickname: '',
    comments: [],
    commentText: '',
    activeTab: 'created', // 'created' (我发起的) | 'joined' (我参与的)
    searchKeyword: ''
  },

  onLoad(options) {
    // 计算自定义导航栏高度
    try {
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menuButton = wx.getMenuButtonBoundingClientRect()
      const statusBarHeight = systemInfo.statusBarHeight || 20
      const navHeight = menuButton ? (menuButton.top - statusBarHeight) * 2 + menuButton.height : 44
      this.setData({
        statusBarHeight,
        navHeight,
        customNavHeight: statusBarHeight + navHeight
      })
    } catch (e) {
      this.setData({ statusBarHeight: 20, navHeight: 44, customNavHeight: 64 })
    }

    if (options.invite_token) {
      this.inviteToken = options.invite_token
    } else if (options.scene) {
      const scene = decodeURIComponent(options.scene)
      // 小程序码 scene 格式: "t=5" (trip_id)
      if (scene.startsWith('t=')) {
        this.pendingTripId = scene.substring(2)
      } else {
        this.inviteToken = scene
      }
    } else if (options.trip_id) {
      this.pendingTripId = options.trip_id
    }
  },

  onShow() {
    if (app.globalData.token) {
      this.setData({ isLogin: true })
      this.checkInviteToken()
      this.loadTrips()
      this.loadMembers()
      // 检查是否有昵称
      const userInfo = app.globalData.userInfo
      if (!userInfo || !userInfo.nickname) {
        this.setData({ showNicknamePicker: true })
      }
    }
  },

  checkInviteToken() {
    if (this.inviteToken) {
      const token = this.inviteToken
      this.inviteToken = null // consume
      app.request({
        url: '/trips/join/',
        method: 'POST',
        data: { token }
      }).then(res => {
        wx.showToast({ title: '成功加入行程', icon: 'success' })
        this.loadTrips()
        this.loadMembers()
      }).catch(err => {
        const msg = (err && err.data && err.data.error) || '加入行程失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
    } else if (this.pendingTripId) {
      // 通过分享链接的 trip_id 获取邀请 token 后加入
      const tripId = this.pendingTripId
      this.pendingTripId = null
      app.request({
        url: `/trips/${tripId}/invite/`,
        method: 'GET'
      }).then(res => {
        if (res.token) {
          return app.request({
            url: '/trips/join/',
            method: 'POST',
            data: { token: res.token }
          })
        }
      }).then(res => {
        if (res) {
          wx.showToast({ title: '成功加入行程', icon: 'success' })
          this.loadTrips()
          this.loadMembers()
        }
      }).catch(err => {
        const msg = (err && err.data && err.data.error) || '加入行程失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
    }
  },

  // 微信登录
  onLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          app.request({
            url: '/auth/login/',
            method: 'POST',
            data: { code: res.code }
          }).then(data => {
            // 保存 token
            app.globalData.token = data.token
            app.globalData.userInfo = data.user
            wx.setStorageSync('token', data.token)
            wx.setStorageSync('userInfo', data.user)
            
            this.setData({ isLogin: true })
            this.checkInviteToken()
            this.loadTrips()
            this.loadMembers()

            wx.showToast({ title: '登录成功', icon: 'success' })
          }).catch(err => {
            console.error('登录失败', err)
            wx.showToast({ title: '登录失败', icon: 'none' })
          })
        }
      }
    })
  },

  // 加载成员列表
  loadMembers() {
    app.request({ url: '/auth/members/' }).then(data => {
      this.setData({ members: data })
    })
  },
  // 跳转到旅行回忆页面
  onGoToMemory(e) {
    const tripId = e.currentTarget.dataset.id
    if (tripId) {
      wx.navigateTo({
        url: `/pages/memory/index?tripId=${tripId}&id=${tripId}`
      })
    }
  },

  // 点击成员头像
  onMemberTap(e) {
    const member = e.currentTarget.dataset.member
    const trip = e.currentTarget.dataset.trip
    const userInfo = app.globalData.userInfo

    const avatarSrc = member.avatar_url || (member.nickname === '潮唧唧' ? '/images/1_jiji.jpg' : member.nickname === '飞机' ? '/images/2_feiji.jpg' : member.nickname === '宝哥' ? '/images/3_baoge.jpg' : member.nickname === '平胸' ? '/images/4_pingxion.jpg' : '/images/default-avatar.jpg')

    let itemList = []
    let actions = []

    if (userInfo && member.id === userInfo.id) {
      itemList.push('查看头像', '更换头像', '修改我的昵称', '修改职责')
      actions.push('preview', 'change_avatar', 'edit_my_nickname', 'change_role')
    } else {
      itemList.push('查看头像')
      actions.push('preview')
    }

    // 行程创建者具备权限：可以修改他人昵称和微调排序
    if (userInfo && trip && trip.creator_id === userInfo.id && member.id !== userInfo.id) {
      itemList.push('修改成员昵称', '左移', '右移')
      actions.push('edit_member_nickname', 'move_left', 'move_right')
    }

    if (itemList.length === 1) {
      this.setData({ previewAvatar: avatarSrc })
      return
    }

    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const action = actions[res.tapIndex]
        if (action === 'preview') {
          this.setData({ previewAvatar: avatarSrc })
        } else if (action === 'change_avatar') {
          this.uploadAvatar()
        } else if (action === 'edit_my_nickname') {
          this.editMyNickname()
        } else if (action === 'change_role') {
          this.editRole(trip.id)
        } else if (action === 'edit_member_nickname') {
          this.editMemberNickname(trip.id, member.id, member.nickname)
        } else if (action === 'move_left') {
          this.moveMember(trip.id, member.id, 'left')
        } else if (action === 'move_right') {
          this.moveMember(trip.id, member.id, 'right')
        }
      }
    })
  },

  editMyNickname() {
    const userInfo = app.globalData.userInfo
    wx.showModal({
      title: '修改我的昵称',
      editable: true,
      placeholderText: userInfo ? userInfo.nickname : '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          app.request({
            url: '/auth/nickname/',
            method: 'POST',
            data: { nickname: res.content.trim() }
          }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.loadMembers()
            this.loadTrips()
          }).catch(err => {
            const msg = err.data && err.data.error ? err.data.error : '修改失败'
            wx.showToast({ title: msg, icon: 'none' })
          })
        }
      }
    })
  },

  editMemberNickname(tripId, memberId, currentNickname) {
    wx.showModal({
      title: '修改成员昵称',
      editable: true,
      placeholderText: currentNickname || '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          app.request({
            url: '/auth/member-nickname/',
            method: 'POST',
            data: {
              trip_id: tripId,
              member_id: memberId,
              nickname: res.content.trim()
            }
          }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            this.loadTrips()
          }).catch(err => {
            const msg = err.data && err.data.error ? err.data.error : '修改失败'
            wx.showToast({ title: msg, icon: 'none' })
          })
        }
      }
    })
  },

  moveMember(tripId, memberId, direction) {
    app.request({
      url: `/trips/${tripId}/reorder_members/`,
      method: 'POST',
      data: { member_id: memberId, direction }
    }).then(() => {
      this.loadTrips()
    }).catch(err => {
      const msg = err.data && err.data.error ? err.data.error : err.data && err.data.message ? err.data.message : '操作失败'
      wx.showToast({ title: msg, icon: 'none' })
    })
  },

  // 上传头像
  uploadAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        app.uploadFile({
          url: '/auth/profile/',
          filePath,
          name: 'avatar'
        }).then(() => {
          wx.showToast({ title: '头像已更新', icon: 'success' })
          this.loadMembers()
          this.loadTrips()
        }).catch(() => {
          wx.showToast({ title: '上传失败', icon: 'none' })
        })
      }
    })
  },

  // 修改职责
  editRole(tripId) {
    wx.showModal({
      title: '修改职责',
      editable: true,
      placeholderText: '如：司机、导游、摄影...',
      success: (res) => {
        if (res.confirm && res.content) {
          const newRole = res.content.trim()
          app.request({
            url: '/auth/profile/',
            method: 'POST',
            data: { role: newRole, trip_id: tripId }
          }).then(() => {
            wx.showToast({ title: '已更新', icon: 'success' })
            // 局部更新当前行程中当前用户的 role
            const userId = app.globalData.userInfo && app.globalData.userInfo.id
            const allTrips = this.data.allTrips || []
            allTrips.forEach(trip => {
              if (trip.id === tripId && trip.trip_members) {
                trip.trip_members.forEach(m => {
                  if (m.id === userId) m.role = newRole
                })
              }
            })
            this.setData({ allTrips }, () => { this.filterTrips() })
          })
        }
      }
    })
  },

  // 加载行程列表
  loadTrips() {
    this.setData({ loading: true })
    app.request({
      url: '/trips/'
    }).then(data => {
      const allTrips = data.results || data
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      const currentUserId = userInfo ? userInfo.id : null

      allTrips.forEach(trip => {
        const start = new Date(trip.start_date)
        const end = new Date(trip.end_date)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)

        // 判断状态：规划中 / 进行中 / 已完成
        if (today < start) {
          trip.status_text = '规划中'
          trip.status_class = 'planning'
          trip.status = 'planning'
        } else if (today >= start && today <= end) {
          trip.status_text = '进行中'
          trip.status_class = 'ongoing'
          trip.status = 'ongoing'
        } else {
          trip.status_text = '已完成'
          trip.status_class = 'completed'
          trip.status = 'completed'
        }

        // 计算天数
        const diffMs = Math.abs(end - start)
        const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
        trip.total_days = totalDays

        // 计算地点数
        let placeCount = 0
        if (trip.days) {
          trip.days.forEach(d => {
            if (d.places) placeCount += d.places.length
          })
        }
        trip.places_count = placeCount

        // 格式化日期：08/01 - 08/02
        const sMonth = String(start.getMonth() + 1).padStart(2, '0')
        const sDay = String(start.getDate()).padStart(2, '0')
        const eMonth = String(end.getMonth() + 1).padStart(2, '0')
        const eDay = String(end.getDate()).padStart(2, '0')
        trip.formatted_date_range = `${sMonth}/${sDay} - ${eMonth}/${eDay}`

        // 是否是我创建的 (双重判定：ID 匹配 或 昵称匹配)
        const rawCreator = trip.creator_id !== undefined ? trip.creator_id : trip.created_by
        const creatorId = typeof rawCreator === 'object' ? rawCreator.id : rawCreator
        
        let isCreator = Boolean(currentUserId && Number(creatorId) === Number(currentUserId))
        trip.is_creator = isCreator

        const diff = Math.ceil((start - today) / (1000 * 60 * 60 * 24))
        trip.countdown = diff
        trip.expanded = false
      })

      this.setData({ allTrips, loading: false }, () => {
        this.filterTrips()
      })

      this.checkMemoryGuide(allTrips)
    }).catch(err => {
      console.error('加载失败', err)
      this.setData({ loading: false })
    })
  },

  // 切换 [我发起的] vs [我参与的]
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, () => {
      this.filterTrips()
    })
  },

  // 搜索输入
  onSearchInput(e) {
    const kw = e.detail.value || ''
    this.setData({ searchKeyword: kw }, () => {
      this.filterTrips()
    })
  },

  // 清空搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.filterTrips()
    })
  },

  // 过滤行程列表
  filterTrips() {
    const { allTrips, activeTab, searchKeyword } = this.data
    let filtered = allTrips || []

    // 1. 按 tab 区分：我发起的 (created) vs 我参与的 (joined)
    if (activeTab === 'created') {
      filtered = filtered.filter(t => t.is_creator)
    } else if (activeTab === 'joined') {
      filtered = filtered.filter(t => !t.is_creator)
    }

    // 2. 按搜索词过滤
    if (searchKeyword && searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      filtered = filtered.filter(t => {
        const titleMatch = t.title && t.title.toLowerCase().includes(kw)
        const destMatch = t.destination && t.destination.toLowerCase().includes(kw)
        return titleMatch || destMatch
      })
    }

    this.setData({ trips: filtered })
  },

  // 新建行程
  onAddTrip() {
    wx.navigateTo({ url: '/pages/trip/edit' })
  },

  // 扫码加入行程
  onScanJoin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const result = res.result || ''
        // 解析二维码内容，提取 trip_id
        let tripId = null
        if (result.includes('trip_id=')) {
          const match = result.match(/trip_id=(\d+)/)
          if (match) tripId = match[1]
        } else if (result.includes('t=')) {
          const match = result.match(/t=(\d+)/)
          if (match) tripId = match[1]
        } else if (/^\d+$/.test(result.trim())) {
          tripId = result.trim()
        }

        if (!tripId) {
          wx.showToast({ title: '无效的邀请码', icon: 'none' })
          return
        }

        // 用 trip_id 获取 invite token 再加入
        app.request({
          url: `/trips/${tripId}/invite/`
        }).then(inviteRes => {
          if (inviteRes.token) {
            return app.request({
              url: '/trips/join/',
              method: 'POST',
              data: { token: inviteRes.token }
            })
          }
        }).then(res => {
          if (res) {
            wx.showToast({ title: '成功加入行程', icon: 'success' })
            this.loadTrips()
          }
        }).catch(err => {
          const msg = (err && err.data && err.data.error) || '加入失败'
          wx.showToast({ title: msg, icon: 'none' })
        })
      },
      fail: () => {}
    })
  },

  // 查看行程详情
  onTripDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: `/pages/trip/detail?id=${id}` })
    }
  },

  // 切换折叠状态
  toggleTrip(e) {
    const index = e.currentTarget.dataset.index
    const expanded = this.data.trips[index].expanded
    this.setData({ [`trips[${index}].expanded`]: !expanded })
  },

  // 阻止冒泡
  stopBubble() {},

  // 弹出邀请二维码弹窗
  onShowInviteQr(e) {
    const trip = e.currentTarget.dataset.trip
    if (!trip) return
    // 只有创建者可以邀请
    const userInfo = app.globalData.userInfo
    if (!trip.is_creator && !(userInfo && Number(trip.creator_id || trip.created_by) === userInfo.id)) {
      wx.showToast({ title: '只有行程发起人可以邀请', icon: 'none' })
      return
    }
    this.setData({
      showInviteModal: true,
      inviteTripTitle: trip.title,
      inviteTripDates: trip.formatted_date_range || `${trip.start_date} ~ ${trip.end_date}`,
      inviteQrCodeUrl: ''
    })
    app.request({
      url: `/trips/${trip.id}/invite/`
    }).then(res => {
      this.setData({ inviteQrCodeUrl: res.qr_base64 })
    }).catch(err => {
      wx.showToast({ title: '生成邀请码失败', icon: 'none' })
      this.setData({ showInviteModal: false })
    })
  },

  onCloseInvite() {
    this.setData({ showInviteModal: false, inviteQrCodeUrl: '', inviteTripTitle: '' })
  },

  // 分享给好友
  onShareAppMessage(res) {
    if (res.from === 'button') {
      const trip = res.target.dataset.trip
      return {
        title: `邀请你加入行程：${trip.title}`,
        path: `/pages/index/index?trip_id=${trip.id}`
      }
    }
    return {
      title: '跟我一起去旅行吧！',
      path: '/pages/index/index'
    }
  },

  // --- 拖动排序与点击放大触发逻辑 ---
  dragStart(e) {
    const tripIndex = e.currentTarget.dataset.tripIndex;
    const memberIndex = e.currentTarget.dataset.memberIndex;
    const trip = this.data.trips[tripIndex];
    const touch = e.touches[0] || e.changedTouches[0];

    this.dragState = {
      tripIndex,
      startIndex: memberIndex,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      lastSwapTime: Date.now(),
      hasChanged: false,
      isDraggingStarted: false,
      canDrag: app.globalData.userInfo && trip.creator_id === app.globalData.userInfo.id
    };
  },

  dragMove(e) {
    if (!this.dragState || !this.dragState.canDrag) return;
    const touch = e.touches[0] || e.changedTouches[0];
    const currentX = touch.clientX;
    const deltaX = currentX - this.dragState.startX;
    
    // 只有滑动超过 10px 才激活拖拽样式
    if (!this.dragState.isDraggingStarted && Math.abs(deltaX) > 10) {
      this.dragState.isDraggingStarted = true;
      this.setData({
        dragging: true,
        dragInfo: { tripIndex: this.dragState.tripIndex, startIndex: this.dragState.startIndex }
      });
    }

    const ITEM_WIDTH = 50; // 触发交换的阈值
    const now = Date.now();
    
    if (Math.abs(deltaX) > ITEM_WIDTH && now - this.dragState.lastSwapTime > 150) {
      const tripIndex = this.dragState.tripIndex;
      const startIndex = this.dragState.startIndex;
      const targetIndex = deltaX > 0 ? startIndex + 1 : startIndex - 1;
      
      const trips = this.data.trips;
      const members = trips[tripIndex].trip_members;
      
      if (targetIndex >= 0 && targetIndex < members.length) {
        // 交换
        const temp = members[startIndex];
        members[startIndex] = members[targetIndex];
        members[targetIndex] = temp;
        
        this.setData({ 
          [`trips[${tripIndex}].trip_members`]: members,
          'dragInfo.startIndex': targetIndex
        });
        
        this.dragState.startIndex = targetIndex;
        this.dragState.startX = currentX;
        this.dragState.lastSwapTime = now;
        this.dragState.hasChanged = true;
      }
    }
  },

  dragEnd(e) {
    if (!this.dragState) return;
    
    const touch = e.changedTouches[0] || e.touches[0];
    const timeDiff = Date.now() - this.dragState.startTime;
    const distX = touch ? Math.abs(touch.clientX - this.dragState.startX) : 0;
    const distY = touch ? Math.abs(touch.clientY - this.dragState.startY) : 0;

    // 如果按住到松开时间短(<300ms)且移动距离极小(<10px)，精准判定为点击！
    if (timeDiff < 300 && distX < 10 && distY < 10 && !this.dragState.hasChanged) {
      this.onMemberTap(e);
    } else if (this.dragState.hasChanged) {
      // 触发了位置交换，保存至后端
      const tripIndex = this.dragState.tripIndex;
      const trip = this.data.trips[tripIndex];
      const memberIds = trip.trip_members.map(m => m.id);
      
      app.request({
        url: `/trips/${trip.id}/reorder_members_batch/`,
        method: 'POST',
        data: { order: memberIds }
      }).catch(() => {
        wx.showToast({ title: '排序失败', icon: 'none' })
        this.loadTrips()
      })
    }
    
    if (this.dragState.isDraggingStarted) {
      this.setData({ dragging: false, dragInfo: null })
    }
    this.dragState = null;
  },

  // 进入回忆模式
  onEnterMemory(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/memory/index?id=${id}` })
  },

  // 检查是否弹出回忆引导（旅程结束后首次打开）
  checkMemoryGuide(trips) {
    // 仅标题包含"2026自驾"的行程结束后触发回忆弹窗
    const endedTrip = trips.find(t => (t.status_class === 'completed' || t.countdown < 0) && t.title && t.title.includes('2026自驾'))
    if (!endedTrip) return

    // 用 trip id + end_date 作为标记，该行程只弹一次
    const guideKey = `memory_guide_${endedTrip.id}`
    if (wx.getStorageSync(guideKey)) return

    const nickname = app.globalData.userInfo ? app.globalData.userInfo.nickname : ''
    const greeting = nickname ? `你好 ${nickname}，` : ''

    wx.showModal({
      title: '旅途回忆 ✨',
      content: `${greeting}这次旅途已经结束，美好的回忆值得珍藏。要查看旅途回忆吗？`,
      confirmText: '进入回忆',
      cancelText: '下次再说',
      success: (res) => {
        // 标记已弹过
        wx.setStorageSync(guideKey, true)
        if (res.confirm) {
          wx.navigateTo({ url: `/pages/memory/index?id=${endedTrip.id}` })
        }
      }
    })
  },

  // 点击头像放大查看
  onPreviewAvatar(e) {
    const src = e.currentTarget.dataset.src
    this.setData({ previewAvatar: src })
  },

  // 关闭头像预览
  onClosePreview() {
    this.setData({ previewAvatar: '' })
  },

  // 打开行程攻略文档
  onOpenDoc() {
    wx.setClipboardData({
      data: 'https://www.kdocs.cn/l/cav0OdpEAuAE',
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '文档链接已复制到剪贴板，请退出小程序后在微信对话框粘贴打开',
          showCancel: false
        })
      }
    })
  },

  // 预览行程照片
  onPreviewTripPhoto(e) {
    const { photos, index } = e.currentTarget.dataset
    const urls = photos.map(p => p.image_url)
    wx.previewImage({
      current: urls[index],
      urls
    })
  },

  // 查看全部照片
  onViewAllPhotos(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/photos/index?tripId=${id}` })
  },

  // 查看费用明细
  onViewCost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/cost/index?tripId=${id}` })
  },

  // 编辑注意事项
  onEditNotice(e) {
    const tripId = e.currentTarget.dataset.id
    const note = e.currentTarget.dataset.note || ''
    wx.showModal({
      title: '注意事项',
      editable: true,
      placeholderText: '带好身份证、充电器、换洗衣物...',
      content: note,
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/trips/${tripId}/`,
            method: 'PATCH',
            data: { note: res.content }
          }).then(() => {
            wx.showToast({ title: '已保存', icon: 'success' })
            this.loadTrips()
          })
        }
      }
    })
  },

  // 头像昵称表单
  onChooseAvatar(e) {
    this.setData({ tempAvatarUrl: e.detail.avatarUrl })
  },
  onInputNickname(e) {
    this.setData({ tempNickname: e.detail.value })
  },
  onSubmitProfile() {
    const { tempAvatarUrl, tempNickname } = this.data
    if (!tempNickname) {
      return wx.showToast({ title: '请输入昵称', icon: 'none' })
    }
    
    wx.showLoading({ title: '保存中' })
    let p = Promise.resolve()
    if (tempAvatarUrl && !tempAvatarUrl.startsWith('http')) {
      p = app.uploadFile({
        url: '/auth/profile/',
        filePath: tempAvatarUrl,
        name: 'avatar'
      })
    }
    
    p.then(() => {
      return app.request({
        url: '/auth/nickname/',
        method: 'POST',
        data: { nickname: tempNickname }
      })
    }).then(() => {
      wx.hideLoading()
      const userInfo = app.globalData.userInfo || {}
      userInfo.nickname = tempNickname
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ showNicknamePicker: false })
      wx.showToast({ title: `你好，${tempNickname}！`, icon: 'success' })
      this.loadMembers()
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },

  // 加载首页评论（取第一个行程的）
  loadComments() {
    const trips = this.data.trips
    if (trips.length > 0) {
      app.request({
        url: `/comments/?trip_id=${trips[0].id}`
      }).then(data => {
        this.setData({ comments: data.results || data })
      })
    }
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

  // 长按删除自己的评论
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
    const trips = this.data.trips
    if (trips.length === 0) return
    app.request({
      url: '/comments/',
      method: 'POST',
      data: { trip: trips[0].id, content }
    }).then(() => {
      this.setData({ commentText: '' })
      this.loadComments()
    }).catch(() => {
      wx.showToast({ title: '发送失败', icon: 'none' })
    })
  }
})
