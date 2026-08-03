from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def invite_page(request):
    """微信直接扫码时的提示页面"""
    html = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>加入行程</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fdfbf7;color:#1e293b;text-align:center;padding:20px;}
.card{background:#fff;border-radius:16px;padding:40px 30px;box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:320px;}
h2{margin:0 0 12px;font-size:20px;}
p{color:#64748b;font-size:14px;line-height:1.6;margin:0;}
.icon{font-size:48px;margin-bottom:16px;}</style>
</head><body><div class="card"><div class="icon">📱</div><h2>请在小程序中扫码加入</h2><p>打开「我的行程本」小程序<br>点击首页「扫码加入」按钮<br>扫描该二维码即可加入行程</p></div></body></html>"""
    return HttpResponse(html, content_type="text/html")


urlpatterns = [
    path("invite", invite_page, name="invite-page"),
    path("api/v1/", include("trips.urls")),
]

# 开发环境下提供媒体文件访问
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
