# 最紧要去旅游 - 设计文档

## 项目概述

微信小程序，用于规划和记录旅行行程。支持记录酒店、景点、餐厅等地点信息，每个地点可上传照片。

## 技术架构

```
┌─────────────────┐         ┌──────────────────────────────┐
│  微信小程序前端   │  HTTP   │  Django REST API (后端)        │
│  (WXML/WXSS/JS) │ ──────> │  Gunicorn + Nginx (8092)      │
└─────────────────┘         │  SQLite(开发) / PostgreSQL(生产)│
                            │  照片存储: media/              │
                            └──────────────────────────────┘
```

### 技术栈

- 后端：Django 4.2 + Django REST Framework
- 数据库：SQLite（本地开发）/ PostgreSQL（生产）
- 前端：微信小程序原生开发
- 部署：Ubuntu 22.04 + Nginx + Gunicorn + systemd
- 服务器：your-server-ip（Ubuntu 22.04 + Nginx + Gunicorn）

## 数据模型

### User（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | 主键 |
| openid | CharField(128) | 微信 openid，唯一标识 |
| nickname | CharField(64) | 昵称 |
| avatar_url | URLField | 头像 URL |
| created_at | DateTimeField | 创建时间 |

### Trip（行程）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | 主键 |
| user | ForeignKey(User) | 创建者 |
| title | CharField(100) | 行程名称，如"东京五日游" |
| destination | CharField(100) | 目的地 |
| start_date | DateField | 开始日期 |
| end_date | DateField | 结束日期 |
| cover_image | ImageField | 封面图（可选） |
| note | TextField | 备注（可选） |
| created_at | DateTimeField | 创建时间 |
| updated_at | DateTimeField | 更新时间 |

### DayPlan（每日计划）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | 主键 |
| trip | ForeignKey(Trip) | 关联行程 |
| date | DateField | 日期 |
| day_number | IntegerField | 第几天（1, 2, 3...） |
| note | TextField | 当天备注（可选） |

### Place（地点）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | 主键 |
| day_plan | ForeignKey(DayPlan) | 关联哪天 |
| type | CharField(20) | 类型：hotel/scenic/restaurant/transport/other |
| name | CharField(100) | 地点名称 |
| address | CharField(200) | 地址（可选） |
| start_time | TimeField | 计划时间（可选） |
| end_time | TimeField | 结束时间（可选） |
| cost | DecimalField | 费用（可选） |
| note | TextField | 备注（可选） |
| order | IntegerField | 排序序号 |
| created_at | DateTimeField | 创建时间 |

### Photo（照片）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | AutoField | 主键 |
| place | ForeignKey(Place) | 关联地点 |
| image | ImageField | 图片文件 |
| caption | CharField(200) | 图片说明（可选） |
| uploaded_at | DateTimeField | 上传时间 |

## API 设计

Base URL: `http://127.0.0.1:8000/api/v1/`（本地）/ `https://your-domain.com/api/v1/`（生产）

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/login/ | 微信登录（传 code，返回 token） |

### 行程
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /trips/ | 我的行程列表 |
| POST | /trips/ | 创建行程 |
| GET | /trips/{id}/ | 行程详情（含每日计划和地点） |
| PUT | /trips/{id}/ | 更新行程 |
| DELETE | /trips/{id}/ | 删除行程 |

### 每日计划
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /trips/{trip_id}/days/ | 某行程的每日计划列表 |
| POST | /trips/{trip_id}/days/ | 添加一天 |
| PUT | /days/{id}/ | 更新某天 |
| DELETE | /days/{id}/ | 删除某天 |

### 地点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /days/{day_id}/places/ | 某天的地点列表 |
| POST | /days/{day_id}/places/ | 添加地点 |
| PUT | /places/{id}/ | 更新地点 |
| DELETE | /places/{id}/ | 删除地点 |
| POST | /places/reorder/ | 调整地点排序 |

### 照片
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /places/{place_id}/photos/ | 某地点的照片列表 |
| POST | /places/{place_id}/photos/ | 上传照片 |
| DELETE | /photos/{id}/ | 删除照片 |

## 页面规划

### tabBar
- 首页（行程列表）
- 我的

### 页面列表
| 页面 | 路径 | 说明 |
|------|------|------|
| 行程列表 | pages/index/index | 首页，卡片展示所有行程 |
| 行程详情 | pages/trip/detail | 按天展示时间轴，每天下面列出地点 |
| 创建/编辑行程 | pages/trip/edit | 表单：名称、目的地、日期 |
| 地点详情 | pages/place/detail | 地点信息 + 照片墙 |
| 添加/编辑地点 | pages/place/edit | 表单：类型、名称、地址、时间、备注 |
| 照片预览 | pages/photo/preview | 全屏查看照片 |
| 我的 | pages/mine/index | 个人信息、设置 |

### 交互流程
```
行程列表 → 点击卡片 → 行程详情（时间轴）
                         ├── 点击某天 "+" → 添加地点
                         └── 点击地点 → 地点详情
                                          └── 上传/查看照片
```

## 地点类型

| type | 图标 | 说明 |
|------|------|------|
| hotel | 🏨 | 酒店/住宿 |
| scenic | 🏞️ | 景点 |
| restaurant | 🍽️ | 餐厅/美食 |
| transport | 🚗 | 交通（机场、车站） |
| other | 📍 | 其他 |

## 部署方案

### 服务器配置
```
Nginx (8092) → Gunicorn (127.0.0.1:8002) → Django
```

### 目录结构（服务器）
```
/data/travel-mini/
├── backend/
├── travel_venv/
├── media/          # 上传的照片
├── staticfiles/    # collectstatic
└── .env            # 环境变量
```

## 开发计划

1. 阶段一：后端 API + 小程序基础页面（本地开发）
2. 阶段二：照片上传功能
3. 阶段三：部署到服务器
4. 阶段四：完善 UI、多人协作
