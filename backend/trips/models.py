from django.db import models


class User(models.Model):
    """微信小程序用户"""

    openid = models.CharField(max_length=128, unique=True, verbose_name="微信OpenID")
    nickname = models.CharField(max_length=64, blank=True, default="", verbose_name="昵称")
    avatar_url = models.URLField(blank=True, default="", verbose_name="头像URL")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True, verbose_name="头像")
    role = models.CharField(max_length=64, blank=True, default="", verbose_name="职责")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "用户"
        verbose_name_plural = "用户"

    def __str__(self):
        return self.nickname or self.openid[:8]

    @property
    def is_authenticated(self):
        return True


class Trip(models.Model):
    """行程"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trips", verbose_name="创建者")
    title = models.CharField(max_length=100, verbose_name="行程名称")
    destination = models.CharField(max_length=100, blank=True, default="", verbose_name="目的地")
    start_date = models.DateField(verbose_name="开始日期")
    end_date = models.DateField(verbose_name="结束日期")
    members_count = models.IntegerField(default=1, verbose_name="出行人数")
    cover_image = models.ImageField(upload_to="covers/", blank=True, null=True, verbose_name="封面图")
    note = models.TextField(blank=True, default="", verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "行程"
        verbose_name_plural = "行程"
        ordering = ["-start_date"]

    def __str__(self):
        return self.title


class DayPlan(models.Model):
    """每日计划"""

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="days", verbose_name="行程")
    date = models.DateField(verbose_name="日期")
    day_number = models.IntegerField(verbose_name="第几天")
    note = models.TextField(blank=True, default="", verbose_name="备注")

    class Meta:
        verbose_name = "每日计划"
        verbose_name_plural = "每日计划"
        ordering = ["day_number"]
        unique_together = ["trip", "date"]

    def __str__(self):
        return f"{self.trip.title} - Day {self.day_number}"


class Place(models.Model):
    """地点"""

    TYPE_CHOICES = [
        ("hotel", "酒店"),
        ("scenic", "景点"),
        ("restaurant", "餐厅"),
        ("transport", "交通"),
        ("other", "其他"),
    ]

    day_plan = models.ForeignKey(DayPlan, on_delete=models.CASCADE, related_name="places", verbose_name="每日计划")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="scenic", verbose_name="类型")
    name = models.CharField(max_length=100, verbose_name="名称")
    address = models.CharField(max_length=200, blank=True, default="", verbose_name="地址")
    latitude = models.FloatField(blank=True, null=True, verbose_name="纬度")
    longitude = models.FloatField(blank=True, null=True, verbose_name="经度")
    start_time = models.TimeField(blank=True, null=True, verbose_name="开始时间")
    end_time = models.TimeField(blank=True, null=True, verbose_name="结束时间")
    cost = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="费用")
    note = models.TextField(blank=True, default="", verbose_name="备注")
    order = models.IntegerField(default=0, verbose_name="排序")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "地点"
        verbose_name_plural = "地点"
        ordering = ["order", "start_time"]

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Photo(models.Model):
    """照片"""

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="photos", verbose_name="地点")
    image = models.ImageField(upload_to="photos/%Y/%m/", verbose_name="图片")
    caption = models.CharField(max_length=200, blank=True, default="", verbose_name="说明")
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="上传时间")

    class Meta:
        verbose_name = "照片"
        verbose_name_plural = "照片"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.place.name} - {self.caption or 'photo'}"


class Comment(models.Model):
    """评论"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments", verbose_name="用户")
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="comments", null=True, blank=True, verbose_name="行程")
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="comments", null=True, blank=True, verbose_name="地点")
    content = models.TextField(verbose_name="评论内容")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "评论"
        verbose_name_plural = "评论"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.nickname}: {self.content[:20]}"


class WeatherCache(models.Model):
    """天气缓存，按坐标缓存天气预报，6小时过期"""
    location = models.CharField(max_length=20, unique=True, verbose_name="坐标(经度,纬度)")
    data = models.JSONField(verbose_name="天气数据")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "天气缓存"
        verbose_name_plural = "天气缓存"

    def __str__(self):
        return self.location
