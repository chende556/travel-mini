from rest_framework import serializers

from .models import Comment, DayPlan, Photo, Place, Trip, User


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
            return f"{settings.SITE_URL}{obj.image.url}"
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

    class Meta:
        model = Trip
        fields = [
            "id", "title", "destination", "start_date", "end_date",
            "cover_image", "cover_image_url", "note", "days_count",
            "members_count", "total_cost", "per_person_cost",
            "cost_by_type", "recent_photos", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            from django.conf import settings
            return f"{settings.SITE_URL}{obj.cover_image.url}"
        return ""

    def get_recent_photos(self, obj):
        from django.conf import settings
        photos = Photo.objects.filter(
            place__day_plan__trip=obj
        ).select_related("place__day_plan").order_by("-uploaded_at")[:4]
        return [
            {
                "id": p.id,
                "image_url": f"{settings.SITE_URL}{p.image.url}" if p.image else "",
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
        if obj.members_count and obj.members_count > 0:
            return round(total / obj.members_count, 2)
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


class TripDetailSerializer(serializers.ModelSerializer):
    """行程详情（含每日计划）"""
    days = DayPlanSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id", "title", "destination", "start_date", "end_date",
            "cover_image", "cover_image_url", "note", "days",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            from django.conf import settings
            return f"{settings.SITE_URL}{obj.cover_image.url}"
        return ""


class CommentSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(source="user.nickname", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "user", "nickname", "trip", "place", "content", "created_at"]
        read_only_fields = ["id", "user", "nickname", "created_at"]
