import re
import requests
from django.conf import settings
from django.db import models
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .authentication import generate_token
from .models import DayPlan, Photo, Place, Trip, User
from .serializers import (
    DayPlanSerializer,
    PhotoSerializer,
    PlaceSerializer,
    TripDetailSerializer,
    TripListSerializer,
)

# 城市坐标映射（用于无经纬度地点的 fallback）
CITY_COORDS = {
    "北京": (39.9042, 116.4074), "北京市": (39.9042, 116.4074),
    "上海": (31.2304, 121.4737), "上海市": (31.2304, 121.4737),
    "广州": (23.1291, 113.2644), "广州市": (23.1291, 113.2644),
    "深圳": (22.5431, 114.0579), "深圳市": (22.5431, 114.0579),
    "成都": (30.5728, 104.0668), "成都市": (30.5728, 104.0668),
    "杭州": (30.2741, 120.1551), "杭州市": (30.2741, 120.1551),
    "重庆": (29.5630, 106.5516), "重庆市": (29.5630, 106.5516),
    "武汉": (30.5928, 114.3055), "武汉市": (30.5928, 114.3055),
    "西安": (34.3416, 108.9398), "西安市": (34.3416, 108.9398),
    "苏州": (31.2989, 120.5853), "苏州市": (31.2989, 120.5853),
    "天津": (39.0842, 117.2009), "天津市": (39.0842, 117.2009),
    "南京": (32.0603, 118.7969), "南京市": (32.0603, 118.7969),
    "长沙": (28.2282, 112.9388), "长沙市": (28.2282, 112.9388),
    "郑州": (34.7466, 113.6253), "郑州市": (34.7466, 113.6253),
    "青岛": (36.0671, 120.3826), "青岛市": (36.0671, 120.3826),
    "沈阳": (41.8357, 123.4328), "沈阳市": (41.8357, 123.4328),
    "宁波": (29.8683, 121.5440), "宁波市": (29.8683, 121.5440),
    "昆明": (24.8801, 102.8329), "昆明市": (24.8801, 102.8329),
    "合肥": (31.8612, 117.2830), "合肥市": (31.8612, 117.2830),
    "哈尔滨": (45.8038, 126.5349), "哈尔滨市": (45.8038, 126.5349),
    "福州": (26.0745, 119.2965), "福州市": (26.0745, 119.2965),
    "厦门": (24.4798, 118.0894), "厦门市": (24.4798, 118.0894),
    "济南": (36.6512, 117.1201), "济南市": (36.6512, 117.1201),
    "太原": (37.8706, 112.5489), "太原市": (37.8706, 112.5489),
    "南昌": (28.6829, 115.8582), "南昌市": (28.6829, 115.8582),
    "贵阳": (26.6470, 106.6302), "贵阳市": (26.6470, 106.6302),
    "南宁": (22.8170, 108.3665), "南宁市": (22.8170, 108.3665),
    "海口": (20.0174, 110.3492), "海口市": (20.0174, 110.3492),
    "乌鲁木齐": (43.8256, 87.6168), "乌鲁木齐市": (43.8256, 87.6168),
    "兰州": (36.0611, 103.8343), "兰州市": (36.0611, 103.8343),
    "银川": (38.4872, 106.2309), "银川市": (38.4872, 106.2309),
    "西宁": (36.6232, 101.7782), "西宁市": (36.6232, 101.7782),
    "拉萨": (29.6525, 91.1721), "拉萨市": (29.6525, 91.1721),
    "三亚": (18.2528, 109.5119), "三亚市": (18.2528, 109.5119),
    "桂林": (25.2736, 110.2902), "桂林市": (25.2736, 110.2902),
    "衡阳": (26.8933, 112.6077), "衡阳市": (26.8933, 112.6077),
    "渭南": (34.4994, 109.5097), "渭南市": (34.4994, 109.5097),
    "许昌": (34.0355, 113.8526), "许昌市": (34.0355, 113.8526),
    "宜昌": (30.6920, 111.2865), "宜昌市": (30.6920, 111.2865),
    "咸宁": (29.8413, 114.3224), "咸宁市": (29.8413, 114.3224),
}


@api_view(["POST"])
@permission_classes([AllowAny])
def wechat_login(request):
    """
    微信登录。
    前端传 code，后端用 code 换取 openid，返回签名 token。
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
        import logging
        logging.getLogger(__name__).error(f"微信接口调用失败: {e}")
        return Response({"error": "微信登录服务暂时不可用，请稍后重试"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    default_avatars = {
        "潮唧唧": "/images/1_jiji.jpg",
        "飞机": "/images/2_feiji.jpg",
        "宝哥": "/images/3_baoge.jpg",
        "平胸": "/images/4_pingxion.jpg",
        "老伍": "/images/default-avatar.jpg",
    }
    user_avatar = ""
    if user.avatar:
        user_avatar = user.avatar.url if user.avatar.url.startswith("http") else f"{settings.SITE_URL}{user.avatar.url}"
    elif user.avatar_url:
        user_avatar = user.avatar_url
    else:
        user_avatar = default_avatars.get(user.nickname, "/images/default-avatar.jpg")

    return Response({
        "token": generate_token(user),
        "user": {
            "id": user.id,
            "nickname": user.nickname,
            "role": user.role,
            "avatar_url": user_avatar,
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
def update_member_nickname(request):
    """行程创建者修改成员昵称"""
    from .models import User
    member_id = request.data.get("member_id")
    new_nickname = request.data.get("nickname", "").strip()
    trip_id = request.data.get("trip_id")
    
    if not member_id or not new_nickname or not trip_id:
        return Response({"error": "参数错误"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        trip = Trip.objects.get(id=trip_id, user=request.user)
    except Trip.DoesNotExist:
        return Response({"error": "只有行程创建者可以修改成员昵称"}, status=status.HTTP_403_FORBIDDEN)
        
    try:
        member = trip.members.get(id=member_id)
        member.nickname = new_nickname
        member.save(update_fields=["nickname"])
        return Response({"message": "修改成功", "nickname": new_nickname})
    except User.DoesNotExist:
        return Response({"error": "成员不存在"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST", "PUT", "PATCH"])
def update_member_role(request, member_id):
    """更新指定成员在某个行程中的职责"""
    from .models import User, TripMember
    role = request.data.get("role", "")
    trip_id = request.data.get("trip_id")
    if role is not None:
        role = str(role).strip()

    try:
        member = User.objects.get(id=member_id)
    except User.DoesNotExist:
        return Response({"error": "成员不存在"}, status=status.HTTP_404_NOT_FOUND)

    is_self = (request.user.id == member.id)
    is_creator = Trip.objects.filter(user=request.user, members=member).exists()

    if not is_self and not is_creator:
        return Response({"error": "无权修改该成员职责"}, status=status.HTTP_403_FORBIDDEN)

    # 如果指定了 trip_id，更新该行程的 TripMember.role
    if trip_id:
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)
        tm, created = TripMember.objects.get_or_create(trip=trip, user=member)
        tm.role = role
        tm.save(update_fields=["role"])
    else:
        # 兼容旧接口：没传 trip_id 时更新用户所有行程的职责
        TripMember.objects.filter(user=member).update(role=role)

    return Response({"message": "职责已更新", "role": role})


@api_view(["GET", "POST"])
def update_profile(request):
    """获取/更新用户头像和职责"""
    from django.conf import settings as django_settings

    user = request.user

    if request.method == "POST":
        role = request.data.get("role")
        trip_id = request.data.get("trip_id")
        avatar = request.FILES.get("avatar")

        if role is not None:
            from .models import TripMember
            if trip_id:
                # 更新指定行程的职责
                try:
                    trip = Trip.objects.get(id=trip_id)
                    tm, created = TripMember.objects.get_or_create(trip=trip, user=user)
                    tm.role = role.strip()
                    tm.save(update_fields=["role"])
                except Trip.DoesNotExist:
                    pass
            else:
                # 兼容旧接口：更新所有行程的职责
                TripMember.objects.filter(user=user).update(role=role.strip())
        if avatar:
            # 压缩头像
            from .utils import compress_image
            avatar = compress_image(avatar)
            user.avatar = avatar
        user.save()

    default_avatars = {
        "潮唧唧": "/images/1_jiji.jpg",
        "飞机": "/images/2_feiji.jpg",
        "宝哥": "/images/3_baoge.jpg",
        "平胸": "/images/4_pingxion.jpg",
        "老伍": "/images/default-avatar.jpg",
    }
    avatar_url = ""
    if user.avatar:
        avatar_url = user.avatar.url if user.avatar.url.startswith("http") else f"{django_settings.SITE_URL}{user.avatar.url}"
    elif user.avatar_url:
        avatar_url = user.avatar_url
    else:
        avatar_url = default_avatars.get(user.nickname, "/images/default-avatar.jpg")

    return Response({
        "id": user.id,
        "nickname": user.nickname,
        "role": user.role,
        "avatar_url": avatar_url,
    })


@api_view(["POST"])
def upload_image(request):
    """通用图片上传接口（用于 moments 等场景），返回图片 URL"""
    from django.conf import settings as django_settings
    from .utils import compress_image

    image = request.FILES.get("image")
    if not image:
        return Response({"error": "缺少图片文件"}, status=status.HTTP_400_BAD_REQUEST)

    # 压缩图片
    image = compress_image(image)

    # 保存到 photos 目录
    import os
    from datetime import datetime
    from django.core.files.storage import default_storage

    date_path = datetime.now().strftime("%Y/%m")
    filename = f"photos/{date_path}/{image.name}"
    saved_path = default_storage.save(filename, image)
    file_url = default_storage.url(saved_path)

    # 确保返回完整 URL
    if not file_url.startswith("http"):
        file_url = f"{django_settings.SITE_URL}{file_url}"

    return Response({"url": file_url}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def list_members(request):
    """获取与当前用户有共同行程的成员列表"""
    from django.conf import settings as django_settings

    trips = Trip.objects.filter(members=request.user)
    users = User.objects.filter(joined_trips__in=trips).distinct().order_by('id')
    
    members = []
    for u in users:
        avatar_url = ""
        if u.avatar:
            avatar_url = u.avatar.url if u.avatar.url.startswith("http") else f"{django_settings.SITE_URL}{u.avatar.url}"
        elif u.avatar_url:
            avatar_url = u.avatar_url
            
        members.append({
            "id": u.id,
            "nickname": u.nickname,
            "role": "",
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
        return Trip.objects.filter(members=self.request.user).prefetch_related("members", "days", "days__places").distinct()

    def perform_create(self, serializer):
        trip = serializer.save(user=self.request.user)
        trip.members.add(self.request.user)
        # 创建 TripMember 记录
        from .models import TripMember
        TripMember.objects.get_or_create(trip=trip, user=self.request.user)
        # 自动创建每日计划
        from datetime import timedelta
        days = (trip.end_date - trip.start_date).days + 1
        for i in range(days):
            DayPlan.objects.create(
                trip=trip,
                date=trip.start_date + timedelta(days=i),
                day_number=i + 1,
            )

    @action(detail=True, methods=["POST", "DELETE"])
    def remove_member(self, request, pk=None):
        """移除行程成员（仅行程发起人可操作）"""
        trip = self.get_object()
        if trip.user != request.user:
            return Response({"error": "只有行程发起人可以移除队员"}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get("member_id") or request.query_params.get("member_id")
        if not member_id:
            return Response({"error": "缺少 member_id 参数"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(id=member_id)
        except User.DoesNotExist:
            return Response({"error": "成员不存在"}, status=status.HTTP_404_NOT_FOUND)

        if member.id == trip.user.id:
            return Response({"error": "不能移除行程发起人自己"}, status=status.HTTP_400_BAD_REQUEST)

        trip.members.remove(member)
        if isinstance(trip.member_order, list) and member.id in trip.member_order:
            trip.member_order.remove(member.id)
            trip.save(update_fields=["member_order"])

        trip.members_count = trip.members.count()
        trip.save(update_fields=["members_count"])

        return Response({
            "message": f"已将【{member.nickname or '队员'}】移出行程",
            "members_count": trip.members_count
        })

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

    from rest_framework.decorators import action
    @action(detail=True, methods=["post"])
    def reorder_members(self, request, pk=None):
        trip = self.get_object()
        if trip.user != request.user:
            return Response({"error": "只有创建者可以修改成员顺序"}, status=status.HTTP_403_FORBIDDEN)
        
        member_id = request.data.get("member_id")
        direction = request.data.get("direction") # "left" or "right"
        if not member_id or direction not in ("left", "right"):
            return Response({"error": "参数错误"}, status=status.HTTP_400_BAD_REQUEST)
            
        members = list(trip.members.all())
        order = trip.member_order or []
        for m in members:
            if m.id not in order:
                order.append(m.id)
                
        try:
            current_index = order.index(int(member_id))
        except ValueError:
            return Response({"error": "成员不在行程中"}, status=status.HTTP_404_NOT_FOUND)
            
        if direction == "left" and current_index > 0:
            swap_index = current_index - 1
        elif direction == "right" and current_index < len(order) - 1:
            swap_index = current_index + 1
        else:
            return Response({"message": "已在边界"})
            
        order[current_index], order[swap_index] = order[swap_index], order[current_index]
        trip.member_order = order
        trip.save(update_fields=["member_order"])
        
        return Response({"message": "修改成功"})

    @action(detail=True, methods=["post"])
    def reorder_members_batch(self, request, pk=None):
        trip = self.get_object()
        if trip.user != request.user:
            return Response({"error": "只有创建者可以修改成员顺序"}, status=status.HTTP_403_FORBIDDEN)
            
        order = request.data.get("order", [])
        if not isinstance(order, list):
            return Response({"error": "参数错误"}, status=status.HTTP_400_BAD_REQUEST)
            
        trip.member_order = order
        trip.save(update_fields=["member_order"])
        return Response({"message": "批量修改成功"})


class DayPlanViewSet(viewsets.ModelViewSet):
    """每日计划"""
    serializer_class = DayPlanSerializer

    def get_queryset(self):
        qs = DayPlan.objects.filter(trip__members=self.request.user).distinct()
        trip_id = self.kwargs.get("trip_id")
        if trip_id:
            return qs.filter(trip_id=trip_id)
        return qs


class PlaceViewSet(viewsets.ModelViewSet):
    """地点 CRUD"""
    serializer_class = PlaceSerializer

    def get_queryset(self):
        qs = Place.objects.filter(day_plan__trip__members=self.request.user).distinct()
        day_id = self.kwargs.get("day_id")
        if day_id:
            return qs.filter(day_plan_id=day_id)
        return qs

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

    # 权限校验：确保用户是该地点所属行程的成员
    if not place.day_plan.trip.members.filter(id=request.user.id).exists():
        return Response({"error": "无权操作"}, status=status.HTTP_403_FORBIDDEN)

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
        qs = Photo.objects.filter(place__day_plan__trip__members=self.request.user).distinct()
        place_id = self.kwargs.get("place_id")
        if place_id:
            return qs.filter(place_id=place_id)
        return qs

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
        trip = Trip.objects.prefetch_related(
            "days__places__photos"
        ).get(id=trip_id, members=request.user)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    days = []
    for day in trip.days.all().order_by("day_number"):
        day_photos = []
        for place in day.places.all().order_by("order", "start_time"):
            photos = sorted(place.photos.all(), key=lambda p: p.uploaded_at, reverse=True)
            if photos:
                day_photos.append({
                    "place_name": place.name,
                    "place_type": place.get_type_display(),
                    "photos": [
                        {
                            "id": p.id,
                            "image_url": p.image.url if p.image and p.image.url.startswith("http") else (f"{settings.SITE_URL}{p.image.url}" if p.image else ""),
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
def all_photos(request):
    """获取当前用户所有行程的照片列表"""
    from django.conf import settings

    trips = Trip.objects.filter(members=request.user).prefetch_related(
        "days__places__photos"
    ).distinct().order_by("-start_date")
    result_trips = []

    for trip in trips:
        days = []
        for day in trip.days.all().order_by("day_number"):
            day_photos = []
            for place in day.places.all().order_by("order", "start_time"):
                photos = sorted(place.photos.all(), key=lambda p: p.uploaded_at, reverse=True)
                if photos:
                    day_photos.append({
                        "place_name": place.name,
                        "place_type": place.get_type_display(),
                        "photos": [
                            {
                                "id": p.id,
                                "image_url": p.image.url if p.image and p.image.url.startswith("http") else (f"{settings.SITE_URL}{p.image.url}" if p.image else ""),
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
        if days:
            result_trips.append({
                "trip_id": trip.id,
                "trip_title": trip.title,
                "days": days
            })

    return Response(result_trips)


@api_view(["GET"])
def trip_cost_summary(request, trip_id):
    """获取行程费用汇总，按地点类型分组"""
    from django.db.models import Sum

    try:
        trip = Trip.objects.get(id=trip_id, members=request.user)
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
        qs = Comment.objects.filter(trip__members=self.request.user).distinct()
        trip_id = self.request.query_params.get("trip_id")
        place_id = self.request.query_params.get("place_id")
        if trip_id:
            return qs.filter(trip_id=trip_id, place__isnull=True)
        if place_id:
            return qs.filter(place_id=place_id)
        return qs

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

    # 权限校验：确保用户是该地点所属行程的成员
    if not place.day_plan.trip.members.filter(id=request.user.id).exists():
        return Response({"error": "无权访问"}, status=status.HTTP_403_FORBIDDEN)

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
    """批量获取行程所有有坐标地点的天气（带超时保护，避免卡顿）"""
    qweather_key = os.environ.get("QWEATHER_API_KEY", "")
    qweather_host = os.environ.get("QWEATHER_API_HOST", "")
    if not qweather_key or not qweather_host:
        return Response({})

    try:
        trip = Trip.objects.get(id=trip_id, members=request.user)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)

    # 行程目的地作为兜底城市名（同一行程的地点大概率在同一城市）
    fallback_city = trip.destination.split(",")[0].split("，")[0].split("、")[0].strip() if trip.destination else ""

    places = Place.objects.filter(day_plan__trip=trip)[:50]
    result = {}
    for place in places:
        # 交通类型（自驾/飞机/火车）优先用出发地坐标
        if place.type in ('drive', 'transport', 'flight', 'train') and place.start_latitude and place.start_longitude:
            weather = get_weather_by_location(place.start_longitude, place.start_latitude)
        elif place.latitude and place.longitude:
            weather = get_weather_by_location(place.longitude, place.latitude)
        else:
            # 无坐标的地点：用行程目的地兜底
            weather = get_weather_by_name(place.address or place.name, fallback_city)
        if weather:
            result[place.id] = weather

    return Response(result)


def get_weather_by_location(longitude, latitude):
    """获取天气数据（带缓存与1秒超短超时防卡顿），返回天气字典或 None"""
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

    # 调用 API（给 1 秒强卡超时，防止长挂）
    url = f"{qweather_host}/v7/weather/3d?location={location}&lang=zh"
    try:
        resp = requests.get(
            url,
            headers={"X-QW-Api-Key": qweather_key, "accept": "application/json"},
            timeout=1.0
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


def get_weather_by_name(name, fallback_city=""):
    """通过地名查询天气（先查和风天气城市搜索 API 获取坐标，再查天气）"""
    from .models import WeatherCache
    from django.utils import timezone
    from datetime import timedelta

    if not name and not fallback_city:
        return None

    qweather_key = os.environ.get("QWEATHER_API_KEY", "")
    qweather_host = os.environ.get("QWEATHER_API_HOST", "")
    if not qweather_key or not qweather_host:
        return None

    # 尝试从地名/地址中提取城市关键词
    city_name = clean_to_city_name(name) if name else ""
    if not city_name:
        # 如果地名本身不含城市信息，使用行程目的地作为兜底
        city_name = clean_to_city_name(fallback_city) if fallback_city else ""
    if not city_name:
        city_name = fallback_city or name[:4].strip() if name else ""
    if not city_name:
        return None

    # 用城市名做缓存 key
    cache_key = f"name:{city_name}"
    cache = WeatherCache.objects.filter(location=cache_key).first()
    if cache and (timezone.now() - cache.updated_at) < timedelta(hours=6):
        return cache.data

    # 查询城市搜索 API 获取坐标
    search_url = f"{qweather_host}/geo/v2/city/lookup?location={city_name}&lang=zh&number=1"
    try:
        resp = requests.get(
            search_url,
            headers={"X-QW-Api-Key": qweather_key, "accept": "application/json"},
            timeout=1.5
        )
        geo_data = resp.json()
    except Exception:
        if cache:
            return cache.data
        return None

    if geo_data.get("code") != "200" or not geo_data.get("location"):
        if cache:
            return cache.data
        return None

    loc = geo_data["location"][0]
    lon = loc.get("lon", "")
    lat = loc.get("lat", "")
    if not lon or not lat:
        return None

    # 用坐标查天气
    weather = get_weather_by_location(float(lon), float(lat))

    # 也以城市名做一份缓存
    if weather:
        WeatherCache.objects.update_or_create(
            location=cache_key,
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
        trip = Trip.objects.get(id=trip_id, members=request.user)
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
                    "image_url": photo.image.url if photo.image and photo.image.url.startswith("http") else (f"{django_settings.SITE_URL}{photo.image.url}" if photo.image else ""),
                    "place_name": place.name,
                    "day_number": day.day_number,
                    "date": day.date.strftime("%Y-%m-%d"),
                })

    # 所有有坐标的地点（用于地图轨迹，按城市去重只保留城市名）
    markers = []
    seen_marker_cities = set()
    for day in trip.days.all().order_by("day_number"):
        for place in day.places.all().order_by("order", "start_time"):
            if place.latitude and place.longitude:
                # 从地址提取城市名
                addr = place.address or place.name
                city = clean_to_city_name(addr)
                if not city and trip.destination:
                    city = clean_to_city_name(trip.destination.split(",")[0])
                if not city:
                    city = place.name

                # 每个城市只保留一个标记点（用真实坐标）
                if city not in seen_marker_cities:
                    seen_marker_cities.add(city)
                    markers.append({
                        "id": place.id,
                        "name": place.name,
                        "city": city,
                        "type": place.type,
                        "latitude": float(place.latitude),
                        "longitude": float(place.longitude),
                        "day_number": day.day_number,
                    })

    # 成员列表
    from .models import TripMember
    members_list = list(trip.members.all())
    order = trip.member_order or []
    members_list.sort(key=lambda m: order.index(m.id) if m.id in order else 999999)
    
    role_map = {tm.user_id: tm.role for tm in TripMember.objects.filter(trip=trip)}
    
    members = []
    for u in members_list:
        avatar_url = ""
        if u.avatar:
            avatar_url = u.avatar.url if u.avatar.url.startswith("http") else f"{django_settings.SITE_URL}{u.avatar.url}"
        elif u.avatar_url:
            avatar_url = u.avatar_url
            
        members.append({
            "nickname": u.nickname,
            "role": role_map.get(u.id, ""),
            "avatar_url": avatar_url,
        })

    # 提取唯一的路线城市节点与时间轴 (含点间距离计算)
    route_nodes = []
    seen_route_cities = set()
    prev_coord = None
    last_city_added = None

    for day in trip.days.all().order_by("day_number"):
        day_date_str = day.date.strftime("%Y.%m.%d") if day.date else f"Day {day.day_number}"
        day_places = day.places.all().order_by("order", "start_time")
        
        for place in day_places:
            raw = place.address or place.end_location or place.start_location or place.name
            c_name = clean_to_city_name(raw)
            if not c_name and trip.destination:
                c_name = clean_to_city_name(trip.destination.split(",")[0])
            if not c_name:
                c_name = "目的地"

            # 避免相邻重复出现相同的城市节点
            if c_name == last_city_added:
                continue

            # 获取位置坐标
            lat = place.latitude or place.start_latitude or place.end_latitude
            lng = place.longitude or place.start_longitude or place.end_longitude
            
            if not (lat and lng) and c_name:
                coord = CITY_COORDS.get(c_name, CITY_COORDS.get(c_name.rstrip("市"), (34.3416, 108.9398)))
                lat, lng = float(coord[0]), float(coord[1])

            seen_route_cities.add(c_name)
            last_city_added = c_name
            
            # 计算与上一个城市节点的距离 (Haversine 驾车换算)
            if prev_coord and lat and lng:
                from math import radians, cos, sin, asin, sqrt
                r_lat1, r_lon1, r_lat2, r_lon2 = map(radians, [prev_coord[0], prev_coord[1], lat, lng])
                dlon = r_lon2 - r_lon1
                dlat = r_lat2 - r_lat1
                a = sin(dlat / 2)**2 + cos(r_lat1) * cos(r_lat2) * sin(dlon / 2)**2
                c = 2 * asin(sqrt(a))
                km = round(6371 * c * 1.32, 1) # 驾车路网换算
                if route_nodes:
                    route_nodes[-1]["distance_next"] = km

            if lat and lng:
                prev_coord = (lat, lng)
            
            colors = ["green", "amber", "blue", "terracotta", "purple"]
            color = colors[len(route_nodes) % len(colors)]

            route_nodes.append({
                "id": len(route_nodes) + 1,
                "city": c_name,
                "date": day_date_str,
                "color": color,
                "latitude": lat,
                "longitude": lng,
                "distance_next": 0
            })

    # 兜底：若节点为空，解析 trip.destination
    if not route_nodes and trip.destination:
        dest_items = [clean_to_city_name(x) for x in trip.destination.replace("、", ",").replace("，", ",").split(",") if clean_to_city_name(x)]
        colors = ["green", "amber", "blue", "terracotta", "purple"]
        prev_c_coord = None
        for idx, c in enumerate(dest_items):
            coord = CITY_COORDS.get(c, CITY_COORDS.get(c.rstrip("市"), (34.3416, 108.9398)))
            c_lat, c_lng = float(coord[0]), float(coord[1])
            if prev_c_coord and route_nodes:
                from math import radians, cos, sin, asin, sqrt
                r_lat1, r_lon1, r_lat2, r_lon2 = map(radians, [prev_c_coord[0], prev_c_coord[1], c_lat, c_lng])
                dlon = r_lon2 - r_lon1
                dlat = r_lat2 - r_lat1
                a = sin(dlat / 2)**2 + cos(r_lat1) * cos(r_lat2) * sin(dlon / 2)**2
                c_dist = round(6371 * 2 * asin(sqrt(a)) * 1.32, 1)
                route_nodes[-1]["distance_next"] = c_dist

            prev_c_coord = (c_lat, c_lng)
            route_nodes.append({
                "id": idx + 1,
                "city": c,
                "date": trip.start_date.strftime("%Y.%m.%d") if trip.start_date else "",
                "color": colors[idx % len(colors)],
                "latitude": c_lat,
                "longitude": c_lng,
                "distance_next": 0
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
            "cities": len(seen_route_cities) or len(route_nodes) or 1,
            "provinces": max(1, len(seen_route_cities) // 2),
            "total_cost": total_cost,
            "per_person_cost": per_person_cost,
            "members": members_count,
        },
        "photos": all_photos,
        "markers": markers,
        "route_nodes": route_nodes,
        "members": members,
    })


import qrcode
from io import BytesIO
import base64
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired

@api_view(["GET"])
def trip_invite(request, trip_id):
    """生成邀请小程序码和 token（24小时有效）"""
    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)
        
    signer = TimestampSigner()
    token = signer.sign(f"{trip.id}:{request.user.id}")
    
    # 生成短 code 用于二维码 scene（8位随机字符）
    import hashlib
    short_code = hashlib.md5(token.encode()).hexdigest()[:8]
    
    # 存到缓存（利用 WeatherCache 模型临时存储，或直接用内存）
    # 简单方案：用 trip_id 作为 scene，前端 onLoad 时直接用 trip_id 请求 invite token
    
    # 最简方案：scene 就放 trip_id，前端收到后调 /trips/{id}/invite/ 拿 token 再 join
    from urllib.parse import quote
    encoded_token = quote(token, safe='')
    
    # 生成小程序码（scene 放 trip_id，32字符内）
    access_token = get_wechat_access_token()
    qr_b64 = None
    
    if access_token:
        try:
            resp = requests.post(
                f"https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token={access_token}",
                json={"scene": f"t={trip.id}", "page": "pages/index/index", "width": 430},
                timeout=5
            )
            if resp.headers.get("content-type", "").startswith("image"):
                qr_b64 = f"data:image/png;base64,{base64.b64encode(resp.content).decode()}"
        except Exception:
            pass
    
    # fallback 普通二维码（内容为网页URL，微信扫码会打开提示页；小程序内扫码可解析 trip_id）
    if not qr_b64:
        path = f"{settings.SITE_URL}/invite?trip_id={trip.id}"
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(path)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        qr_b64 = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
    
    return Response({
        "token": token,
        "qr_base64": qr_b64
    })


def get_wechat_access_token():
    """获取微信 access_token（带简单缓存）"""
    import time
    
    token = getattr(get_wechat_access_token, '_token', None)
    expire = getattr(get_wechat_access_token, '_expire', 0)
    
    if token and time.time() < expire:
        return token
    
    try:
        resp = requests.get(
            "https://api.weixin.qq.com/cgi-bin/token",
            params={
                "grant_type": "client_credential",
                "appid": settings.WECHAT_APP_ID,
                "secret": settings.WECHAT_APP_SECRET,
            },
            timeout=5
        )
        data = resp.json()
        if "access_token" in data:
            get_wechat_access_token._token = data["access_token"]
            get_wechat_access_token._expire = time.time() + data.get("expires_in", 7200) - 300
            return data["access_token"]
    except Exception:
        pass
    return None

@api_view(["POST"])
def trip_join(request):
    """扫码加入行程"""
    token = request.data.get("token")
    if not token:
        return Response({"error": "缺少 token"}, status=status.HTTP_400_BAD_REQUEST)
        
    signer = TimestampSigner()
    try:
        # 限制 24 小时 (86400秒) 有效
        data = signer.unsign(token, max_age=14400)
    except SignatureExpired:
        return Response({"error": "邀请已过期"}, status=status.HTTP_400_BAD_REQUEST)
    except BadSignature:
        return Response({"error": "无效的邀请"}, status=status.HTTP_400_BAD_REQUEST)
        
    trip_id, inviter_id = data.split(":")
    
    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "行程不存在"}, status=status.HTTP_404_NOT_FOUND)
        
    # 加入行程
    trip.members.add(request.user)
    # 创建 TripMember 记录
    from .models import TripMember
    TripMember.objects.get_or_create(trip=trip, user=request.user)
    return Response({"message": "成功加入行程", "trip_id": trip.id})


from .models import Moment, MomentComment
from .serializers import MomentSerializer, MomentCommentSerializer


class MomentViewSet(viewsets.ModelViewSet):
    """游记动态：默认仅同行程队员可见"""
    serializer_class = MomentSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Moment.objects.none()

        # 1. 当前用户参与的所有行程
        my_trips = Trip.objects.filter(members=user)
        # 2. 与当前用户处于同一行程中的所有队友（包括自己）
        teammates = User.objects.filter(joined_trips__in=my_trips).distinct()

        # 动态过滤：仅同行程成员发表或关联同行程的动态可见
        return Moment.objects.filter(
            models.Q(trip__in=my_trips) | models.Q(trip__isnull=True, user__in=teammates)
        ).distinct().order_by("-created_at")

    def perform_create(self, serializer):
        trip_id = self.request.data.get("trip")
        if trip_id:
            try:
                trip = Trip.objects.get(id=trip_id, members=self.request.user)
                serializer.save(user=self.request.user, trip=trip)
                return
            except Trip.DoesNotExist:
                pass
        # 不传 trip 则所有队友可见
        serializer.save(user=self.request.user)


@api_view(["POST"])
def toggle_moment_like(request, moment_id):
    """点赞 / 取消点赞 游记动态"""
    try:
        moment = Moment.objects.get(id=moment_id)
    except Moment.DoesNotExist:
        return Response({"error": "动态不存在"}, status=status.HTTP_404_NOT_FOUND)

    # 权限校验：确保用户有权看到该动态（同行程成员）
    user = request.user
    my_trips = Trip.objects.filter(members=user)
    teammates = User.objects.filter(joined_trips__in=my_trips).distinct()
    if moment.user != user and moment.user not in teammates:
        return Response({"error": "无权操作"}, status=status.HTTP_403_FORBIDDEN)

    if moment.likes.filter(id=request.user.id).exists():
        moment.likes.remove(request.user)
        is_liked = False
    else:
        moment.likes.add(request.user)
        is_liked = True

    return Response({
        "is_liked": is_liked,
        "likes_count": moment.likes.count(),
        "liked_nicknames": [u.nickname or "匿名" for u in moment.likes.all()[:10]]
    })


@api_view(["POST"])
def add_moment_comment(request, moment_id):
    """添加游记动态评论"""
    try:
        moment = Moment.objects.get(id=moment_id)
    except Moment.DoesNotExist:
        return Response({"error": "动态不存在"}, status=status.HTTP_404_NOT_FOUND)

    content = request.data.get("content", "").strip()
    if not content:
        return Response({"error": "评论内容不能为空"}, status=status.HTTP_400_BAD_REQUEST)

    comment = MomentComment.objects.create(moment=moment, user=request.user, content=content)
    serializer = MomentCommentSerializer(comment)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def clean_to_city_name(raw_text):
    """把各类地址或名称字符串一律净化为标准的 'XXX市'，消除多余修饰词"""
    if not raw_text:
        return ""
    text = str(raw_text).strip()
    
    # 过滤非城市修饰词
    for kw in ["自驾", "机票", "高铁", "火车", "行程", "打卡", "住宿", "酒店", "餐厅", "美食", "体验", "专线", "站", "机场"]:
        text = text.replace(kw, "")
    text = text.strip()
    
    provinces = [
        "北京市", "天津市", "上海市", "重庆市",
        "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省",
        "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省", "河南省", "湖北省", "湖南省",
        "广东省", "海南省", "四川省", "贵州省", "云南省", "陕西省", "甘肃省", "青海省", "台湾省",
        "内蒙古自治区", "广西壮族自治区", "西藏自治区", "宁夏回族自治区", "新疆维吾尔自治区",
        "香港特别行政区", "澳门特别行政区",
        "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
        "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
        "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
        "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门"
    ]
    
    for p in sorted(provinces, key=len, reverse=True):
        if text.startswith(p):
            text = text[len(p):].strip()
            break
            
    # 先精准匹配预置城市词库
    for c in ["北京", "上海", "广州", "深圳", "成都", "杭州", "重庆", "武汉", "西安", "苏州", "天津", "南京", "长沙", "郑州", "青岛", "沈阳", "宁波", "昆明", "合肥", "哈尔滨", "福州", "厦门", "济南", "太原", "南昌", "贵阳", "南宁", "海口", "乌鲁木齐", "兰州", "银川", "西宁", "拉萨", "三亚", "桂林", "衡阳", "渭南", "许昌", "宜昌", "咸宁", "华山"]:
        if c in text:
            return f"{c}市" if not (c.endswith("市") or c.endswith("山")) else c

    match = re.search(r'([\u4e00-\u9fa5]{2,5}(?:市|州|地区|盟))', text)
    if match:
        city_str = match.group(1)
        return city_str

    # 无法识别有效城市名，返回空
    return ""


@api_view(["GET"])
def footprint_summary(request):
    """获取用户的足迹地图数据（安全浮点类型转换 & 严格剥离省份）"""
    try:
        from django.utils import timezone
        today = timezone.now().date()

        all_trips = Trip.objects.filter(members=request.user).prefetch_related("days", "days__places").distinct()

        cities = set()
        seen_cities_been = set()
        seen_cities_want = set()
        seen_cities_light = set()

        been_markers = []
        want_markers = []
        light_markers = []

        total_places = 0
        total_days = 0

        marker_id_counter = 1

        for trip in all_trips:
            is_completed = trip.end_date and trip.end_date < today
            total_days += (trip.end_date - trip.start_date).days + 1 if (trip.end_date and trip.start_date) else 1

            trip_cities = []
            city_best_coord = {}  # 记录每个城市的第一个真实坐标

            if trip.destination:
                for item in trip.destination.replace("、", ",").replace("，", ",").replace(" ", ",").split(","):
                    c_name = clean_to_city_name(item)
                    if c_name:
                        cities.add(c_name)
                        trip_cities.append(c_name)

            for day in trip.days.all():
                for place in day.places.all():
                    total_places += 1
                    addr = place.address or place.name
                    c_name = clean_to_city_name(addr)
                    if c_name:
                        cities.add(c_name)
                        if c_name not in trip_cities:
                            trip_cities.append(c_name)

                    # 记录每个城市第一个遇到的真实坐标
                    if place.latitude and place.longitude and c_name:
                        if c_name not in city_best_coord:
                            city_best_coord[c_name] = (float(place.latitude), float(place.longitude))

                        if c_name not in seen_cities_light:
                            seen_cities_light.add(c_name)
                            m_item = {
                                "id": marker_id_counter,
                                "latitude": float(place.latitude),
                                "longitude": float(place.longitude),
                                "title": c_name,
                                "callout": {
                                    "content": c_name,
                                    "padding": 4,
                                    "borderRadius": 8,
                                    "display": "ALWAYS",
                                    "fontSize": 11,
                                    "color": "#1e293b",
                                    "bgColor": "#ffffff"
                                }
                            }
                            marker_id_counter += 1
                            light_markers.append(m_item)
                            if is_completed:
                                seen_cities_been.add(c_name)
                                been_markers.append(m_item)
                            else:
                                seen_cities_want.add(c_name)
                                want_markers.append(m_item)

            # 对于行程中没有带坐标地点的城市，用已知的真实坐标或 CITY_COORDS fallback
            for c in trip_cities:
                if c not in seen_cities_light:
                    seen_cities_light.add(c)
                    # 优先用该城市已记录的真实坐标
                    if c in city_best_coord:
                        lat, lng = city_best_coord[c]
                    else:
                        coord = CITY_COORDS.get(c, CITY_COORDS.get(c.rstrip("市"), (34.3416, 108.9398)))
                        lat, lng = float(coord[0]), float(coord[1])
                    m_item = {
                        "id": marker_id_counter,
                        "latitude": lat,
                        "longitude": lng,
                        "title": c,
                        "callout": {
                            "content": c,
                            "padding": 4,
                            "borderRadius": 8,
                            "display": "ALWAYS",
                            "fontSize": 11,
                            "color": "#1e293b",
                            "bgColor": "#ffffff"
                        }
                    }
                    marker_id_counter += 1
                    light_markers.append(m_item)
                    if is_completed:
                        seen_cities_been.add(c)
                        been_markers.append(m_item)
                    else:
                        seen_cities_want.add(c)
                        want_markers.append(m_item)

        if not cities:
            cities.add("长沙市")
            cities.add("西安市")

        return Response({
            "provinces_count": 0,
            "cities_count": len(cities),
            "places_count": total_places,
            "trips_count": all_trips.count(),
            "total_days_count": total_days,
            "provinces_list": [],
            "cities_list": list(cities),
            "markers": light_markers,
            "been_markers": been_markers if been_markers else light_markers,
            "want_markers": want_markers if want_markers else light_markers,
            "light_markers": light_markers
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({
            "provinces_count": 0,
            "cities_count": 0,
            "places_count": 0,
            "trips_count": 0,
            "total_days_count": 0,
            "provinces_list": [],
            "cities_list": [],
            "markers": [],
            "been_markers": [],
            "want_markers": [],
            "light_markers": []
        })
