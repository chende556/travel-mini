import requests
from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import DayPlan, Photo, Place, Trip, User
from .serializers import (
    DayPlanSerializer,
    PhotoSerializer,
    PlaceSerializer,
    TripDetailSerializer,
    TripListSerializer,
)


@api_view(["POST"])
@permission_classes([AllowAny])
def wechat_login(request):
    """
    微信登录。
    前端传 code，后端用 code 换取 openid，返回 token（openid）。
    """
    code = request.data.get("code")
    if not code:
        return Response({"error": "缺少 code 参数"}, status=status.HTTP_400_BAD_REQUEST)

    # 调用微信接口换取 openid
    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.WECHAT_APP_ID,
        "secret": settings.WECHAT_APP_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
    except Exception as e:
        return Response({"error": f"微信接口调用失败: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    openid = data.get("openid")
    if not openid:
        return Response({"error": data.get("errmsg", "登录失败")}, status=status.HTTP_400_BAD_REQUEST)

    # 创建或获取用户
    user, created = User.objects.get_or_create(openid=openid)

    # 更新昵称和头像（如果前端传了）
    nickname = request.data.get("nickname", "")
    avatar_url = request.data.get("avatar_url", "")
    if nickname:
        user.nickname = nickname
    if avatar_url:
        user.avatar_url = avatar_url
    if nickname or avatar_url:
        user.save()

    return Response({
        "token": openid,
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "avatar_url": user.avatar_url,
        },
        "is_new": created,
    })


@api_view(["POST"])
def update_nickname(request):
    """更新用户昵称"""
    nickname = request.data.get("nickname", "").strip()
    if not nickname:
        return Response({"error": "昵称不能为空"}, status=status.HTTP_400_BAD_REQUEST)
    request.user.nickname = nickname
    request.user.save()
    return Response({"nickname": nickname})


@api_view(["POST"])
def update_profile(request):
    """更新用户头像和职责"""
    from django.conf import settings as django_settings

    role = request.data.get("role")
    avatar = request.FILES.get("avatar")

    user = request.user
    if role is not None:
        user.role = role.strip()
    if avatar:
        # 压缩头像
        from .utils import compress_image
        avatar = compress_image(avatar)
        user.avatar = avatar
    user.save()

    avatar_url = ""
    if user.avatar:
        avatar_url = f"{django_settings.SITE_URL}{user.avatar.url}"

    return Response({
        "nickname": user.nickname,
        "role": user.role,
        "avatar_url": avatar_url,
    })


@api_view(["GET"])
def list_members(request):
    """获取所有成员列表（有昵称的用户），按固定顺序"""
    from django.conf import settings as django_settings

    # 固定显示顺序
    order = ['潮唧唧', '飞机', '宝哥', '平胸', '老伍']
    users = User.objects.filter(nickname__gt="")
    
    # 按固定顺序排列
    user_map = {u.nickname: u for u in users}
    members = []
    for name in order:
        u = user_map.get(name)
        if u:
            avatar_url = ""
            if u.avatar:
                avatar_url = f"{django_settings.SITE_URL}{u.avatar.url}"
            members.append({
                "id": u.id,
                "nickname": u.nickname,
                "role": u.role,
                "avatar_url": avatar_url,
            })
    # 其他不在列表里的用户追加到末尾
    for u in users:
        if u.nickname not in order:
            avatar_url = ""
            if u.avatar:
                avatar_url = f"{django_settings.SITE_URL}{u.avatar.url}"
            members.append({
                "id": u.id,
                "nickname": u.nickname,
                "role": u.role,
                "avatar_url": avatar_url,
            })
    return Response(members)


class TripViewSet(viewsets.ModelViewSet):
    """行程 CRUD"""

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TripDetailSerializer
        return TripListSerializer

    def get_queryset(self):
        return Trip.objects.all()

    def perform_create(self, serializer):
        trip = serializer.save(user=self.request.user)
        # 自动创建每日计划
        from datetime import timedelta
        days = (trip.end_date - trip.start_date).days + 1
        for i in range(days):
            DayPlan.objects.create(
                trip=trip,
                date=trip.start_date + timedelta(days=i),
                day_number=i + 1,
            )

    def perform_update(self, serializer):
        trip = serializer.save()
        from datetime import timedelta

        new_days = (trip.end_date - trip.start_date).days + 1
        existing_days = trip.days.all().order_by("day_number")
        existing_count = existing_days.count()

        if new_days < existing_count:
            # 删除多余的 DayPlan（从后面删，保留前面的）
            to_delete = existing_days.filter(day_number__gt=new_days)
            to_delete.delete()
        elif new_days > existing_count:
            # 补充缺少的 DayPlan
            for i in range(existing_count, new_days):
                DayPlan.objects.get_or_create(
                    trip=trip,
                    day_number=i + 1,
                    defaults={"date": trip.start_date + timedelta(days=i)},
                )


class DayPlanViewSet(viewsets.ModelViewSet):
    """每日计划"""
    serializer_class = DayPlanSerializer

    def get_queryset(self):
        trip_id = self.kwargs.get("trip_id")
        if trip_id:
            return DayPlan.objects.filter(trip_id=trip_id)
        return DayPlan.objects.all()


class PlaceViewSet(viewsets.ModelViewSet):
    """地点 CRUD"""
    serializer_class = PlaceSerializer

    def get_queryset(self):
        day_id = self.kwargs.get("day_id")
        if day_id:
            return Place.objects.filter(day_plan_id=day_id)
        return Place.objects.all()

    def perform_create(self, serializer):
        day_id = self.kwargs.get("day_id")
        if day_id:
            serializer.save(day_plan_id=day_id)
        else:
            serializer.save()


@api_view(["POST"])
def reorder_place(request):
    """调整地点排序（上移/下移）"""
    place_id = request.data.get("place_id")
    direction = request.data.get("direction")  # "up" or "down"

    if not place_id or direction not in ("up", "down"):
        return Response({"error": "参数错误"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        place = Place.objects.get(id=place_id)
    except Place.DoesNotExist:
        return Response({"error": "地点不存在"}, status=status.HTTP_404_NOT_FOUND)

    # 获取同一天的所有地点，按 order 排序
    siblings = list(Place.objects.filter(day_plan=place.day_plan).order_by("order", "id"))
    current_index = next((i for i, p in enumerate(siblings) if p.id == place.id), None)

    if current_index is None:
        return Response({"error": "地点不存在"}, status=status.HTTP_404_NOT_FOUND)

    if direction == "up" and current_index > 0:
        swap_index = current_index - 1
    elif direction == "down" and current_index < len(siblings) - 1:
        swap_index = current_index + 1
    else:
        return Response({"message": "已在边界"})

    # 交换 order
    siblings[current_index].order, siblings[swap_index].order = siblings[swap_index].order, siblings[current_index].order
    # 如果 order 相同，用索引强制区分
    if siblings[current_index].order == siblings[swap_index].order:
        siblings[current_index].order = swap_index
        siblings[swap_index].order = current_index
    siblings[current_index].save()
    siblings[swap_index].save()

    return Response({"message": "排序成功"})


class PhotoViewSet(viewsets.ModelViewSet):
    """照片"""
    serializer_class = PhotoSerializer

    def get_queryset(self):
        place_id = self.kwargs.get("place_id")
        if place_id:
            return Photo.objects.filter(place_id=place_id)
        return Photo.objects.all()

    def perform_create(self, serializer):
        from .utils import compress_image

        place_id = self.kwargs.get("place_id")
        image = self.request.FILES.get("image")

        # 压缩图片
        if image:
            image = compress_image(image)

        if place_id:
            serializer.save(place_id=place_id, image=image)
        else:
            serializer.save(image=image)


@api_view(["GET"])
def trip_photos(request, trip_id):
    """获取行程所有照片，按天和地点分组"""
    from django.conf import settings

    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    days = []
    for day in trip.days.all().order_by("day_number"):
        day_photos = []
        for place in day.places.all().order_by("order", "start_time"):
            photos = place.photos.all().order_by("-uploaded_at")
            if photos.exists():
                day_photos.append({
                    "place_name": place.name,
                    "place_type": place.get_type_display(),
                    "photos": [
                        {
                            "id": p.id,
                            "image_url": f"{settings.SITE_URL}{p.image.url}" if p.image else "",
                            "caption": p.caption,
                        }
                        for p in photos
                    ]
                })
        if day_photos:
            days.append({
                "day_number": day.day_number,
                "date": day.date.strftime("%Y-%m-%d"),
                "places": day_photos,
            })

    return Response({"trip_title": trip.title, "days": days})


@api_view(["GET"])
def trip_cost_summary(request, trip_id):
    """获取行程费用汇总，按地点类型分组"""
    from django.db.models import Sum

    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    # 按类型汇总
    type_map = dict(Place.TYPE_CHOICES)
    categories = []
    places = Place.objects.filter(day_plan__trip=trip)

    for type_code, type_name in Place.TYPE_CHOICES:
        result = places.filter(type=type_code).aggregate(total=Sum("cost"))
        total = float(result["total"] or 0)
        if total > 0:
            # 获取该类型下的明细
            items = places.filter(type=type_code, cost__gt=0).values_list("name", "cost")
            categories.append({
                "type": type_code,
                "type_name": type_name,
                "total": total,
                "items": [{"name": n, "cost": float(c)} for n, c in items],
            })

    # 总计
    total_result = places.aggregate(total=Sum("cost"))
    total_cost = float(total_result["total"] or 0)
    members_count = trip.members_count or 1
    per_person = round(total_cost / members_count, 2)

    return Response({
        "trip_title": trip.title,
        "members_count": members_count,
        "total_cost": total_cost,
        "per_person_cost": per_person,
        "categories": categories,
    })


from .models import Comment
from .serializers import CommentSerializer


class CommentViewSet(viewsets.ModelViewSet):
    """评论"""
    serializer_class = CommentSerializer

    def get_queryset(self):
        trip_id = self.request.query_params.get("trip_id")
        place_id = self.request.query_params.get("place_id")
        if trip_id:
            return Comment.objects.filter(trip_id=trip_id, place__isnull=True)
        if place_id:
            return Comment.objects.filter(place_id=place_id)
        return Comment.objects.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        if instance.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("只能删除自己的评论")
        instance.delete()


@api_view(["GET"])
def place_weather(request, place_id):
    """查询地点天气预报（带缓存，6小时过期）"""
    try:
        place = Place.objects.get(id=place_id)
    except Place.DoesNotExist:
        return Response({"error": "地点不存在"}, status=status.HTTP_404_NOT_FOUND)

    if not place.latitude or not place.longitude:
        return Response({"error": "该地点没有坐标信息"}, status=status.HTTP_400_BAD_REQUEST)

    weather = get_weather_by_location(place.longitude, place.latitude)
    if weather is None:
        return Response({"error": "天气服务不可用"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({
        "place_id": place.id,
        "place_name": place.name,
        "weather": weather
    })


@api_view(["GET"])
def trip_weather(request, trip_id):
    """批量获取行程所有有坐标地点的天气（用于 dayplan 列表显示）"""
    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    places = Place.objects.filter(day_plan__trip=trip).exclude(latitude=None).exclude(longitude=None)
    result = {}
    for place in places:
        weather = get_weather_by_location(place.longitude, place.latitude)
        if weather:
            result[place.id] = weather

    return Response(result)


def get_weather_by_location(longitude, latitude):
    """获取天气数据（带缓存），返回天气字典或 None"""
    from .models import WeatherCache
    from django.utils import timezone
    from datetime import timedelta

    qweather_key = os.environ.get("QWEATHER_API_KEY", "")
    qweather_host = os.environ.get("QWEATHER_API_HOST", "")
    if not qweather_key or not qweather_host:
        return None

    # 坐标取两位小数作为缓存 key（同城市坐标接近，共享缓存）
    location = f"{longitude:.2f},{latitude:.2f}"

    # 查缓存
    cache = WeatherCache.objects.filter(location=location).first()
    if cache and (timezone.now() - cache.updated_at) < timedelta(hours=6):
        return cache.data

    # 调用 API
    url = f"{qweather_host}/v7/weather/3d?location={location}&lang=zh"
    try:
        resp = requests.get(
            url,
            headers={"X-QW-Api-Key": qweather_key, "accept": "application/json"},
            timeout=10
        )
        data = resp.json()
    except Exception:
        # API 调用失败，返回旧缓存（如果有）
        if cache:
            return cache.data
        return None

    if data.get("code") != "200":
        if cache:
            return cache.data
        return None

    daily = data.get("daily", [])
    today = daily[0] if daily else {}
    weather = {
        "text": today.get("textDay", ""),
        "textNight": today.get("textNight", ""),
        "tempMax": today.get("tempMax", ""),
        "tempMin": today.get("tempMin", ""),
        "humidity": today.get("humidity", ""),
        "windDir": today.get("windDirDay", ""),
        "windScale": today.get("windScaleDay", ""),
        "uvIndex": today.get("uvIndex", ""),
    }

    # 更新缓存
    WeatherCache.objects.update_or_create(
        location=location,
        defaults={"data": weather}
    )

    return weather


import os


@api_view(["GET"])
def trip_memory(request, trip_id):
    """回忆模式数据：统计 + 所有照片 + 所有坐标点 + 成员"""
    from django.db.models import Sum, Count
    from django.conf import settings as django_settings

    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    # 统计数据
    days_count = trip.days.count()
    places = Place.objects.filter(day_plan__trip=trip)
    places_count = places.count()
    photos = Photo.objects.filter(place__day_plan__trip=trip)
    photos_count = photos.count()
    total_cost = float(places.aggregate(total=Sum("cost"))["total"] or 0)
    members_count = trip.members_count or 1
    per_person_cost = round(total_cost / members_count, 2)

    # 所有照片（按时间排序）
    all_photos = []
    for day in trip.days.all().order_by("day_number"):
        for place in day.places.all().order_by("order", "start_time"):
            for photo in place.photos.all().order_by("uploaded_at"):
                all_photos.append({
                    "id": photo.id,
                    "image_url": f"{django_settings.SITE_URL}{photo.image.url}" if photo.image else "",
                    "place_name": place.name,
                    "day_number": day.day_number,
                    "date": day.date.strftime("%Y-%m-%d"),
                })

    # 所有有坐标的地点（用于地图轨迹）
    markers = []
    for day in trip.days.all().order_by("day_number"):
        for place in day.places.all().order_by("order", "start_time"):
            if place.latitude and place.longitude:
                # 从 address 提取城市名
                city = ""
                addr = place.address or ""
                import re
                m = re.search(r'(?:省|自治区)(.+?市)', addr)
                if m:
                    city = m.group(1).rstrip("市")
                elif "市" in addr:
                    m2 = re.search(r'(.+?)市', addr)
                    if m2:
                        city = m2.group(1)
                if not city:
                    city = place.name

                markers.append({
                    "id": place.id,
                    "name": place.name,
                    "city": city,
                    "type": place.type,
                    "latitude": place.latitude,
                    "longitude": place.longitude,
                    "day_number": day.day_number,
                })

    # 成员列表
    order = ['潮唧唧', '飞机', '宝哥', '平胸', '老伍']
    users = User.objects.filter(nickname__gt="")
    user_map = {u.nickname: u for u in users}
    members = []
    for name in order:
        u = user_map.get(name)
        if u:
            avatar_url = ""
            if u.avatar:
                avatar_url = f"{django_settings.SITE_URL}{u.avatar.url}"
            members.append({
                "nickname": u.nickname,
                "role": u.role,
                "avatar_url": avatar_url,
            })

    return Response({
        "trip": {
            "id": trip.id,
            "title": trip.title,
            "destination": trip.destination,
            "start_date": trip.start_date.strftime("%Y-%m-%d"),
            "end_date": trip.end_date.strftime("%Y-%m-%d"),
        },
        "stats": {
            "days": days_count,
            "places": places_count,
            "photos": photos_count,
            "total_cost": total_cost,
            "per_person_cost": per_person_cost,
            "members": members_count,
        },
        "photos": all_photos,
        "markers": markers,
        "members": members,
    })
