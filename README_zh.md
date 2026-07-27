[English](README.md) | [中文](README_zh.md)

# Travel Mini 🚗✈️

一个用于旅行规划和记录的微信小程序。

规划行程、管理每日安排、上传照片、记录费用、与朋友共享编辑。

## 功能特性

- **行程管理** — 创建、编辑、删除行程，设置起止日期
- **每日安排** — 按天组织地点，时间轴展示
- **地点分类** — 酒店 🏨、景点 🏞️、餐厅 🍽️、交通 🚗、其他 📍
- **照片相册** — 按地点上传照片，自动压缩，分组展示
- **费用记录** — 单项费用、总费用、人均自动计算
- **成员系统** — 自定义头像、角色分工（司机、导航等）
- **地图导航** — 地图选点、打开导航
- **评论互动** — 朋友圈风格评论，支持 emoji
- **出发倒计时** — 距出发天数醒目显示
- **行程海报** — Canvas 绘制可分享海报
- **共享编辑** — 所有成员都可添加/编辑地点和照片

## 技术栈

**后端：**
- Python 3.12 + Django 6.0 + Django REST Framework
- SQLite（可切换 PostgreSQL）
- Gunicorn + Nginx

**前端：**
- 微信小程序原生开发（WXML/WXSS/JS）

## 项目结构

```
travel-mini/
├── backend/                 # Django REST API
│   ├── config/              # Django 配置
│   ├── trips/               # 主应用（模型、视图、序列化器）
│   ├── requirements.txt
│   └── .env.example
├── miniprogram/             # 微信小程序
│   ├── pages/               # 所有页面
│   ├── images.example/      # 占位图片
│   ├── app.js.example       # 应用配置模板
│   ├── app.json
│   └── app.wxss
├── DESIGN.md                # 设计文档
└── poster.html              # 功能介绍海报
```

## 快速开始

### 后端

```bash
cd backend
python3 -m venv travel_venv
source travel_venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入微信 AppID、Secret 等

python manage.py migrate
python manage.py runserver
```

### 小程序前端

```bash
cd miniprogram

# 复制示例文件
cp app.js.example app.js
cp -r images.example images

# 编辑 app.js — 设置你的 baseUrl
# 编辑 project.config.json — 设置你的 AppID
```

然后用微信开发者工具打开 `miniprogram/` 目录。

### 部署到服务器

**1. 服务器环境（Ubuntu 22.04）**

```bash
sudo apt update
sudo apt install python3.12 python3.12-venv nginx certbot python3-certbot-nginx -y
```

**2. 上传代码**

```bash
# 在本地执行
rsync -avz --exclude 'travel_venv/' --exclude '.env' --exclude 'db.sqlite3' --exclude 'media/' --exclude '__pycache__/' backend/ root@你的服务器:/data/travel-mini/backend/
```

**3. 创建虚拟环境**

```bash
cd /data/travel-mini/backend
python3.12 -m venv ../travel_venv
source ../travel_venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

**4. 配置环境变量**

```bash
cp .env.example .env
nano .env
# 设置：DEBUG=False, ALLOWED_HOSTS=你的域名, SITE_URL=https://你的域名
# 设置：WECHAT_APP_ID, WECHAT_APP_SECRET, DJANGO_SECRET_KEY

python manage.py migrate
python manage.py collectstatic --noinput
mkdir -p media
```

**5. 申请 SSL 证书（Let's Encrypt）**

```bash
sudo certbot certonly --nginx -d 你的域名
```

**6. Nginx 配置**

创建 `/etc/nginx/conf.d/travel-mini.conf`：

```nginx
server {
    listen 443 ssl;
    server_name 你的域名;
    client_max_body_size 20M;

    ssl_certificate /etc/letsencrypt/live/你的域名/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名/privkey.pem;

    location /static/ {
        alias /data/travel-mini/backend/staticfiles/;
    }

    location /media/ {
        alias /data/travel-mini/backend/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**7. Systemd 服务**

创建 `/etc/systemd/system/travel-mini.service`：

```ini
[Unit]
Description=Travel Mini Gunicorn
After=network.target

[Service]
User=root
WorkingDirectory=/data/travel-mini/backend
ExecStart=/data/travel-mini/travel_venv/bin/gunicorn config.wsgi:application -w 2 -b 127.0.0.1:8002 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start travel-mini
sudo systemctl enable travel-mini
```

**8. 微信小程序后台配置**

登录微信公众平台（mp.weixin.qq.com）：
- 进入「开发管理」→「开发设置」→「服务器域名」
- 将 `https://你的域名` 添加到：request 合法域名、uploadFile 合法域名、downloadFile 合法域名

**9. 验证**

```bash
curl https://你的域名/api/v1/trips/
# 应返回：{"detail":"身份认证信息未提供。"}
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/auth/login/ | 微信登录 |
| GET/POST | /api/v1/trips/ | 行程列表/创建 |
| GET/PUT/DELETE | /api/v1/trips/{id}/ | 行程详情/编辑/删除 |
| GET/POST | /api/v1/trips/{id}/days/ | 每日计划 |
| GET/POST | /api/v1/days/{id}/places/ | 地点列表/添加 |
| PUT/DELETE | /api/v1/places/{id}/ | 编辑/删除地点 |
| POST | /api/v1/places/reorder/ | 调整地点排序 |
| GET/POST | /api/v1/places/{id}/photos/ | 照片列表/上传 |

## 开源协议

MIT
