from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"trips", views.TripViewSet, basename="trip")

urlpatterns = [
    path("auth/login/", views.wechat_login, name="wechat-login"),
    path("auth/nickname/", views.update_nickname, name="update-nickname"),
    path("auth/profile/", views.update_profile, name="update-profile"),
    path("auth/members/", views.list_members, name="list-members"),
    path("", include(router.urls)),
    path("trips/<int:trip_id>/days/", views.DayPlanViewSet.as_view({"get": "list", "post": "create"}), name="day-list"),
    path("days/<int:pk>/", views.DayPlanViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="day-detail"),
    path("days/<int:day_id>/places/", views.PlaceViewSet.as_view({"get": "list", "post": "create"}), name="place-list"),
    path("places/<int:pk>/", views.PlaceViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="place-detail"),
    path("places/reorder/", views.reorder_place, name="place-reorder"),
    path("places/<int:place_id>/photos/", views.PhotoViewSet.as_view({"get": "list", "post": "create"}), name="photo-list"),
    path("photos/<int:pk>/", views.PhotoViewSet.as_view({"get": "retrieve", "delete": "destroy"}), name="photo-detail"),
    path("trips/<int:trip_id>/photos/", views.trip_photos, name="trip-photos"),
    path("trips/<int:trip_id>/cost-summary/", views.trip_cost_summary, name="trip-cost-summary"),
    path("trips/<int:trip_id>/memory/", views.trip_memory, name="trip-memory"),
    path("places/<int:place_id>/weather/", views.place_weather, name="place-weather"),
    path("trips/<int:trip_id>/weather/", views.trip_weather, name="trip-weather"),
    path("comments/", views.CommentViewSet.as_view({"get": "list", "post": "create"}), name="comment-list"),
    path("comments/<int:pk>/", views.CommentViewSet.as_view({"delete": "destroy"}), name="comment-detail"),
]
