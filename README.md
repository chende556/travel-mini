[English](README.md) | [中文](README_zh.md)

# Travel Mini 🚗✈️

A WeChat Mini Program for trip planning and travel recording.

Plan your trips, manage daily itineraries, upload photos, track costs, and share with friends.

## Features

- **Trip Management** — Create, edit, delete trips with date ranges
- **Daily Itinerary** — Organize places by day with timeline view
- **Place Types** — Hotel 🏨, Scenic 🏞️, Restaurant 🍽️, Transport 🚗, Other 📍
- **Photo Album** — Upload photos per place, auto-compression, grouped gallery
- **Cost Tracking** — Per-place cost, total & per-person auto-calculation
- **Member System** — Custom avatars, roles (driver, navigator, etc.)
- **Map & Navigation** — Choose location on map, open navigation
- **Weather Forecast** — Real-time weather for each place (QWeather API, 6h cache)
- **Memory Mode** — Post-trip photo gallery, route map, stats, shareable poster
- **Route Map** — Polyline connecting all places with estimated driving distance
- **Comments** — WeChat Moments-style comments with emoji
- **Countdown** — Days until departure, post-trip memory mode entry
- **Trip Poster** — Canvas-generated shareable poster
- **Shared Editing** — All members can add/edit places and photos

## Tech Stack

**Backend:**
- Python 3.12 + Django 6.0 + Django REST Framework
- SQLite (can switch to PostgreSQL)
- Gunicorn + Nginx

**Frontend:**
- WeChat Mini Program (native WXML/WXSS/JS)

## Project Structure

```
travel-mini/
├── backend/                 # Django REST API
│   ├── config/              # Django settings
│   ├── trips/               # Main app (models, views, serializers)
│   ├── requirements.txt
│   └── .env.example
├── miniprogram/             # WeChat Mini Program
│   ├── pages/               # All pages
│   ├── images.example/      # Placeholder images
│   ├── app.js.example       # App config template
│   ├── app.json
│   └── app.wxss
├── DESIGN.md                # Design document
└── poster.html              # Feature introduction poster
```

## Setup

### Backend

```bash
cd backend
python3 -m venv travel_venv
source travel_venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your WeChat AppID, Secret, etc.

python manage.py migrate
python manage.py runserver
```

### Mini Program

```bash
cd miniprogram

# Copy example files
cp app.js.example app.js
cp -r images.example images

# Edit app.js — set your baseUrl
# Edit project.config.json — set your AppID
```

Then open the `miniprogram/` directory with WeChat DevTools.

### Deployment

**1. Server Prerequisites (Ubuntu 22.04)**

```bash
sudo apt update
sudo apt install python3.12 python3.12-venv nginx certbot python3-certbot-nginx -y
```

**2. Upload Code**

```bash
# From your local machine
rsync -avz --exclude 'travel_venv/' --exclude '.env' --exclude 'db.sqlite3' --exclude 'media/' --exclude '__pycache__/' backend/ root@your-server:/data/travel-mini/backend/
```

**3. Setup Virtual Environment**

```bash
cd /data/travel-mini/backend
python3.12 -m venv ../travel_venv
source ../travel_venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

**4. Configure Environment**

```bash
cp .env.example .env
nano .env
# Set: DEBUG=False, ALLOWED_HOSTS=your-domain.com, SITE_URL=https://your-domain.com
# Set: WECHAT_APP_ID, WECHAT_APP_SECRET, DJANGO_SECRET_KEY

python manage.py migrate
python manage.py collectstatic --noinput
mkdir -p media
```

**5. SSL Certificate (Let's Encrypt)**

```bash
sudo certbot certonly --nginx -d your-domain.com
```

**6. Nginx Configuration**

Create `/etc/nginx/conf.d/travel-mini.conf`:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    client_max_body_size 20M;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

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

**7. Systemd Service**

Create `/etc/systemd/system/travel-mini.service`:

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

**8. WeChat Mini Program Settings**

In WeChat MP admin panel (mp.weixin.qq.com):
- Go to "开发管理" → "开发设置" → "服务器域名"
- Add `https://your-domain.com` to: request, uploadFile, downloadFile

**9. Verify**

```bash
curl https://your-domain.com/api/v1/trips/
# Should return: {"detail":"身份认证信息未提供。"}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login/ | WeChat login |
| POST | /api/v1/auth/profile/ | Update avatar & role |
| GET | /api/v1/auth/members/ | List all members |
| GET/POST | /api/v1/trips/ | List/Create trips |
| GET/PUT/DELETE | /api/v1/trips/{id}/ | Trip detail |
| GET/POST | /api/v1/trips/{id}/days/ | Day plans |
| GET/POST | /api/v1/days/{id}/places/ | Places |
| PUT/DELETE | /api/v1/places/{id}/ | Edit/Delete place |
| POST | /api/v1/places/reorder/ | Reorder places |
| GET/POST | /api/v1/places/{id}/photos/ | Photos |
| DELETE | /api/v1/photos/{id}/ | Delete photo |
| GET | /api/v1/trips/{id}/photos/ | All photos grouped by day |
| GET | /api/v1/trips/{id}/cost-summary/ | Cost summary by type |
| GET | /api/v1/trips/{id}/memory/ | Memory mode data |
| GET | /api/v1/trips/{id}/weather/ | Batch weather for all places |
| GET | /api/v1/places/{id}/weather/ | Weather for single place |
| GET/POST | /api/v1/comments/ | Comments |

## License

MIT
