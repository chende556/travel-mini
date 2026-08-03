from rest_framework import serializers

from .models import Comment, DayPlan, Moment, MomentComment, Photo, Place, Trip, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "openid", "nickname", "avatar_url", "created_at"]
        read_only_fields = ["id", "openid", "created_at"]


class PhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = ["id", "place", "image", "image_url", "caption", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at", "place"]

    def get_image_url(self, obj):
        if obj.image:
            from django.conf import settings
            url = obj.image.url
            return url if url.startswith("http") else f"{settings.SITE_URL}{url}"
        return ""


class PlaceSerializer(serializers.ModelSerializer):
    photos = PhotoSerializer(many=True, read_only=True)
    photo_count = serializers.IntegerField(source="photos.count", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Place
        fields = [
            "id", "day_plan", "type", "type_display", "name", "address",
            "latitude", "longitude",
            "start_location", "start_latitude", "start_longitude",
            "end_location", "end_latitude", "end_longitude", "distance_km",
            "start_time", "end_time", "cost", "note", "order",
            "photos", "photo_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            "day_plan": {"required": False},
        }


class PlaceSimpleSerializer(serializers.ModelSerializer):
    """地点简略版（不含照片详情）"""
    photo_count = serializers.IntegerField(source="photos.count", read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = Place
        fields = [
            "id", "day_plan", "type", "type_display", "name", "address",
            "latitude", "longitude",
            "start_time", "end_time", "cost", "note", "order", "photo_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DayPlanSerializer(serializers.ModelSerializer):
    places = PlaceSimpleSerializer(many=True, read_only=True)

    class Meta:
        model = DayPlan
        fields = ["id", "trip", "date", "day_number", "note", "places"]
        read_only_fields = ["id"]


class TripListSerializer(serializers.ModelSerializer):
    """行程列表（简略）"""
    days_count = serializers.IntegerField(source="days.count", read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    per_person_cost = serializers.SerializerMethodField()
    cost_by_type = serializers.SerializerMethodField()
    recent_photos = serializers.SerializerMethodField()
    trip_members = serializers.SerializerMethodField()
    creator_id = serializers.IntegerField(source="user.id", read_only=True)
    created_by = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id", "title", "destination", "start_date", "end_date",
            "cover_image", "cover_image_url", "note", "days_count",
            "members_count", "member_order", "total_cost", "per_person_cost",
            "cost_by_type", "recent_photos", "trip_members", "creator_id", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            from django.conf import settings
            url = obj.cover_image.url
            return url if url.startswith("http") else f"{settings.SITE_URL}{url}"
        return ""

    def get_recent_photos(self, obj):
        from django.conf import settings
        photos = Photo.objects.filter(
            place__day_plan__trip=obj
        ).select_related("place__day_plan").order_by("-uploaded_at")[:4]
        return [
            {
                "id": p.id,
                "image_url": p.image.url if p.image and p.image.url.startswith("http") else (f"{settings.SITE_URL}{p.image.url}" if p.image else ""),
                "place_name": p.place.name,
                "day_number": p.place.day_plan.day_number,
            }
            for p in photos
        ]

    def get_total_cost(self, obj):
        from django.db.models import Sum
        result = Place.objects.filter(day_plan__trip=obj).aggregate(total=Sum("cost"))
        return float(result["total"] or 0)

    def get_per_person_cost(self, obj):
        total = self.get_total_cost(obj)
        members_count = obj.members.count()
        if members_count and members_count > 0:
            return round(total / members_count, 2)
        return total

    def get_cost_by_type(self, obj):
        from django.db.models import Sum
        type_map = dict(Place.TYPE_CHOICES)
        places = Place.objects.filter(day_plan__trip=obj)
        result = []
        for type_code, type_name in Place.TYPE_CHOICES:
            total = places.filter(type=type_code).aggregate(t=Sum("cost"))["t"]
            if total and float(total) > 0:
                result.append({"type": type_code, "type_name": type_name, "total": float(total)})
        return result

    def get_trip_members(self, obj):
        members = list(obj.members.all())
        order = obj.member_order or []
        members.sort(key=lambda m: order.index(m.id) if m.id in order else 999999)
        
        from django.conf import settings
        from .models import TripMember
        
        role_map = {tm.user_id: tm.role for tm in TripMember.objects.filter(trip=obj)}

        res = []
        default_avatars = {
            "潮唧唧": "/images/1_jiji.jpg",
            "飞机": "/images/2_feiji.jpg",
            "宝哥": "/images/3_baoge.jpg",
            "平胸": "/images/4_pingxion.jpg",
            "老伍": "/images/default-avatar.jpg",
        }
        for m in members:
            avatar_url = ""
            if m.avatar:
                avatar_url = m.avatar.url if m.avatar.url.startswith("http") else f"{settings.SITE_URL}{m.avatar.url}"
            elif m.avatar_url:
                avatar_url = m.avatar_url
            else:
                avatar_url = default_avatars.get(m.nickname, "/images/default-avatar.jpg")

            res.append({
                "id": m.id,
                "nickname": m.nickname,
                "role": role_map.get(m.id, ""),
                "avatar_url": avatar_url
            })
        return res


class TripDetailSerializer(serializers.ModelSerializer):
    """行程详情（含每日计划、成员与职责、费用总计与照片）"""
    days = DayPlanSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    per_person_cost = serializers.SerializerMethodField()
    recent_photos = serializers.SerializerMethodField()
    trip_members = serializers.SerializerMethodField()
    created_by = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id", "title", "destination", "start_date", "end_date",
            "cover_image", "cover_image_url", "note", "days",
            "member_order", "total_cost", "per_person_cost", "recent_photos", "trip_members", "created_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            from django.conf import settings
            url = obj.cover_image.url
            return url if url.startswith("http") else f"{settings.SITE_URL}{url}"
        return ""

    def get_recent_photos(self, obj):
        from django.conf import settings
        photos = Photo.objects.filter(
            place__day_plan__trip=obj
        ).select_related("place__day_plan").order_by("-uploaded_at")[:4]
        return [
            {
                "id": p.id,
                "image_url": p.image.url if p.image and p.image.url.startswith("http") else (f"{settings.SITE_URL}{p.image.url}" if p.image else ""),
                "place_name": p.place.name,
                "day_number": p.place.day_plan.day_number,
            }
            for p in photos
        ]

    def get_total_cost(self, obj):
        from django.db.models import Sum
        result = Place.objects.filter(day_plan__trip=obj).aggregate(total=Sum("cost"))
        return float(result["total"] or 0)

    def get_per_person_cost(self, obj):
        from django.db.models import Sum
        result = Place.objects.filter(day_plan__trip=obj).aggregate(total=Sum("cost"))
        total = float(result["total"] or 0)
        members_count = obj.members.count()
        if members_count and members_count > 0:
            return round(total / members_count, 2)
        return total

    def get_trip_members(self, obj):
        members = list(obj.members.all())
        order = obj.member_order or []
        members.sort(key=lambda m: order.index(m.id) if m.id in order else 999999)
        
        from django.conf import settings
        from .models import TripMember
        
        role_map = {tm.user_id: tm.role for tm in TripMember.objects.filter(trip=obj)}

        res = []
        default_avatars = {
            "潮唧唧": "/images/1_jiji.jpg",
            "飞机": "/images/2_feiji.jpg",
            "宝哥": "/images/3_baoge.jpg",
            "平胸": "/images/4_pingxion.jpg",
            "老伍": "/images/default-avatar.jpg",
        }
        for m in members:
            avatar_url = ""
            if m.avatar:
                avatar_url = m.avatar.url if m.avatar.url.startswith("http") else f"{settings.SITE_URL}{m.avatar.url}"
            elif m.avatar_url:
                avatar_url = m.avatar_url
            else:
                avatar_url = default_avatars.get(m.nickname, "/images/default-avatar.jpg")

            res.append({
                "id": m.id,
                "nickname": m.nickname,
                "role": role_map.get(m.id, ""),
                "avatar_url": avatar_url
            })
        return res


class CommentSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source="user.nickname", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "user", "nickname", "trip", "place", "content", "created_at"]
        read_only_fields = ["id", "user", "nickname", "created_at"]


class MomentCommentSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source="user.nickname", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = MomentComment
        fields = ["id", "user", "nickname", "avatar_url", "content", "created_at"]
        read_only_fields = ["id", "user", "nickname", "avatar_url", "created_at"]

    def get_avatar_url(self, obj):
        from django.conf import settings
        if obj.user.avatar:
            url = obj.user.avatar.url
            return url if url.startswith("http") else f"{settings.SITE_URL}{url}"
        return obj.user.avatar_url or ""


class MomentSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source="user.nickname", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    comments = MomentCommentSerializer(many=True, read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    is_liked = serializers.SerializerMethodField()
    liked_nicknames = serializers.SerializerMethodField()
    trip_title = serializers.CharField(source="trip.title", read_only=True, default="")

    class Meta:
        model = Moment
        fields = [
            "id", "user", "nickname", "avatar_url", "trip", "trip_title", "content",
            "images", "location", "likes_count", "is_liked", "liked_nicknames",
            "comments", "created_at"
        ]
        read_only_fields = ["id", "user", "nickname", "avatar_url", "trip_title", "likes_count", "created_at"]

    def get_avatar_url(self, obj):
        from django.conf import settings
        default_avatars = {
            "潮唧唧": "/images/1_jiji.jpg",
            "飞机": "/images/2_feiji.jpg",
            "宝哥": "/images/3_baoge.jpg",
            "平胸": "/images/4_pingxion.jpg",
            "老伍": "/images/default-avatar.jpg",
        }
        if obj.user.avatar:
            url = obj.user.avatar.url
            return url if url.startswith("http") else f"{settings.SITE_URL}{url}"
        elif obj.user.avatar_url:
            return obj.user.avatar_url
        return default_avatars.get(obj.user.nickname, "/images/default-avatar.jpg")

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_liked_nicknames(self, obj):
        return [u.nickname or "匿名" for u in obj.likes.all()[:10]]
