App({
  globalData: {
    baseUrl: 'https://your-domain.com/api/v1',
    token: '',
    userInfo: null
  },

  onLaunch() {
    // 从本地存储恢复 token
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = wx.getStorageSync('userInfo')
    }
  },

  // 封装请求方法
  request(options) {
    const { url, method = 'GET', data, header = {} } = options
    
    if (this.globalData.token) {
      header['Authorization'] = `Bearer ${this.globalData.token}`
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}${url}`,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...header
        },
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else if (res.statusCode === 401) {
            // token 失效，跳转登录
            wx.removeStorageSync('token')
            reject(res)
          } else {
            reject(res)
          }
        },
        fail(err) {
          reject(err)
        }
      })
    })
  },

  // 上传文件
  uploadFile(options) {
    const { url, filePath, name = 'image', formData = {} } = options
    const header = {}
    
    if (this.globalData.token) {
      header['Authorization'] = `Bearer ${this.globalData.token}`
    }

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${this.globalData.baseUrl}${url}`,
        filePath,
        name,
        header,
        formData,
        success(res) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(res.data))
          } else {
            reject(res)
          }
        },
        fail(err) {
          reject(err)
        }
      })
    })
  }
})
