# Travel Mini 项目进度记录

## 2026-08-02 凌晨开发记录

### 一、代码审查修复（安全 + 质量）

1. ✅ **认证机制重构** — openid 直接做 token → TimestampSigner 签名 token（30天过期），前端 401/403 自动静默 reLogin
2. ✅ **Moments 图片上传** — 从错误的 `/auth/profile/` 改为新建的 `/auth/upload/` 通用图片上传接口
3. ✅ **baseUrl 环境判断** — `__wxConfig.envVersion === 'develop'` 走本地，其他走生产
4. ✅ **settings.py 安全加固** — SECRET_KEY 生产必填、DEBUG 默认 False、ALLOWED_HOSTS 默认空
5. ✅ **权限校验补全** — reorder_place/place_weather/trip_weather/toggle_moment_like 加成员检查
6. ✅ **CITY_COORDS NameError** — 提升为模块级常量
7. ✅ **分享路径修复** — 支持 trip_id 参数自动加入；WXML 事件绑定名修正
8. ✅ **N+1 查询优化** — TripListSerializer.get_total_cost 用 aggregate；photo 视图加 prefetch_related
9. ✅ **缺失 catch 补全** — trip/detail、place/detail、mine/index 多处 API 调用
10. ✅ **setData 性能优化** — 拖拽使用路径更新

### 二、UI/功能改进

11. ✅ **倒计时显示** — 行程卡片显示"X天后出发"/"进行中"，用 SVG 图标
12. ✅ **邀请弹窗优化** — 包含行程名称+日期，配色与行程简介一致，SVG 图标
13. ✅ **天气显示优化** — 进入页面即加载天气；支持无坐标地点通过城市名查天气；交通类用出发地天气；上限扩大到50
14. ✅ **tabBar 图标更新** — 81x81 线条风格（行程/游记/足迹/我的）
15. ✅ **足迹地图标记** — 自定义 marker-pin.png 蓝色定位图标
16. ✅ **足迹工具栏图标** — emoji 全部换为 SVG 内联图标
17. ✅ **海报功能移除** — 去掉不美观的海报生成
18. ✅ **clean_to_city_name 修复** — 去掉粗暴加"市"的 fallback，避免"测试市"
19. ✅ **足迹坐标优先真实位置** — 地点的实际经纬度优先，CITY_COORDS 只做最后 fallback
20. ✅ **回忆页 markers** — 按城市去重，用真实坐标+城市名 callout

### 三、交互体验

21. ✅ **滑动编辑双向** — 概览卡片和地点卡片支持向左滑回关闭
22. ✅ **成员拖动不触发滚动** — scroll-view 拖动时禁用 scroll-x
23. ✅ **个人中心去掉职责** — 职责跟行程走，不在全局显示
24. ✅ **返回保留 Day 展开状态** — loadTrip 保留现有 expanded 状态
25. ✅ **返回不卡顿** — onShow 判断已有数据不重复刷新，编辑操作标记 needRefresh
26. ✅ **地点编辑 UI 优化** — 交通类出发地/目的地简化为一行，距离标签简化
27. ✅ **修改职责不重置排序** — 局部更新 role，不调 loadTrip/loadTrips

### 四、数据模型

28. ✅ **TripMember 中间模型** — 每个行程独立职责（trip + user + role）
29. ✅ **member_order 字段** — 加入 serializer fields，PATCH 能正确保存排序
30. ✅ **is_creator 判断修复** — 去掉错误的昵称 fallback，严格按 creator_id 判断

### 五、邀请/加入机制

31. ✅ **扫码加入功能** — 首页"扫码加入"按钮，wx.scanCode 识别后自动加入
32. ✅ **仅创建者可邀请** — 邀请按钮/入口只有创建者可见
33. ✅ **小程序码生成** — 优先微信 API，fallback 普通二维码（URL 格式，含 trip_id）
34. ✅ **微信扫码提示页** — 直接扫码打开网页提示"请在小程序中扫码加入"
35. ✅ **路由顺序修复** — trips/join/ 移到 router 前面避免被拦截
36. ✅ **trip_invite 权限放开** — 非成员也能获取 token（用于扫码加入场景）
37. ✅ **邀请时效 4 小时** — token max_age 从 86400 改为 14400

### 六、游记动态

38. ✅ **可见范围选择** — 发布动态时可选择关联行程，只有该行程成员可见
39. ✅ **trip_title 显示** — 动态列表显示"XX行程可见"或"所有队友可见"

### 七、其他

40. ✅ **首次登录弹窗** — 支持头像+昵称一起设置
41. ✅ **回忆弹窗触发** — 标题包含"2026自驾"的行程结束后弹出回忆引导
42. ✅ **照片相册入口** — 行程简介中加"照片相册"快捷入口

---

## 部署要点

### 服务器部署
```bash
cd /Users/chende/study/projects/travel-mini
rsync -avz --exclude 'venv/' --exclude 'travel_venv/' \
  --exclude '.env' --exclude 'db.sqlite3' \
  --exclude 'media/' --exclude '__pycache__/' \
  --exclude '.DS_Store' \
  backend/ root@47.120.43.45:/data/travel-mini/backend/

# 服务器上
cd /data/travel-mini/backend
source ../travel_venv/bin/activate
python manage.py migrate
sudo systemctl restart travel-mini
```

### 服务器 .env 配置
```
DJANGO_SECRET_KEY=<随机50位字符串>
DEBUG=False
ALLOWED_HOSTS=www.lovexiaofanqie.fun
SITE_URL=https://www.lovexiaofanqie.fun
```

### 小程序域名配置（微信公众平台）
- request 合法域名: `https://www.lovexiaofanqie.fun`
- downloadFile 合法域名: `https://travel-mini-assets.oss-cn-heyuan.aliyuncs.com`
- uploadFile 合法域名: `https://www.lovexiaofanqie.fun`

### OSS 防盗链
- 允许空 Referer: ✅
- 白名单: `servicewechat.com`

---

## 待办 / 已知问题

- [ ] previewImage 大图预览在真机上可能需要等域名配置生效
- [ ] 小程序码需要正式发布后才能使用（当前 fallback 普通二维码）
- [ ] 照片同步到 OSS 需手动执行 `python sync_oss.py`
