from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"trips", views.TripViewSet, basename="trip")
router.register(r"moments", views.MomentViewSet, basename="moment")

urlpatterns = [
    path("auth/login/", views.wechat_login, name="wechat-login"),
    path("auth/nickname/", views.update_nickname, name="update-nickname"),
    path("auth/profile/", views.update_profile, name="update-profile"),
    path("auth/avatar/", views.update_profile, name="update-avatar"),
    path("auth/upload/", views.upload_image, name="upload-image"),
    path("auth/member-nickname/", views.update_member_nickname, name="update-member-nickname"),
    path("auth/members/", views.list_members, name="list-members"),
    path("auth/members/<int:member_id>/", views.update_member_role, name="update-member-role"),
    path("trips/footprint/", views.footprint_summary, name="footprint-summary"),
    path("trips/join/", views.trip_join, name="trip-join"),
    path("", include(router.urls)),
    path("moments/<int:moment_id>/like/", views.toggle_moment_like, name="moment-like"),
    path("moments/<int:moment_id>/comment/", views.add_moment_comment, name="moment-comment"),
    path("trips/<int:trip_id>/days/", views.DayPlanViewSet.as_view({"get": "list", "post": "create"}), name="day-list"),
    path("days/<int:pk>/", views.DayPlanViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="day-detail"),
    path("days/<int:day_id>/places/", views.PlaceViewSet.as_view({"get": "list", "post": "create"}), name="place-list"),
    path("places/<int:pk>/", views.PlaceViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}), name="place-detail"),
    path("places/reorder/", views.reorder_place, name="place-reorder"),
    path("places/<int:place_id>/photos/", views.PhotoViewSet.as_view({"get": "list", "post": "create"}), name="photo-list"),
    path("photos/<int:pk>/", views.PhotoViewSet.as_view({"get": "retrieve", "delete": "destroy"}), name="photo-detail"),
    path("photos/all/", views.all_photos, name="all-photos"),
    path("trips/<int:trip_id>/photos/", views.trip_photos, name="trip-photos"),
    path("trips/<int:trip_id>/cost-summary/", views.trip_cost_summary, name="trip-cost-summary"),
    path("trips/<int:trip_id>/memory/", views.trip_memory, name="trip-memory"),
    path("trips/<int:trip_id>/invite/", views.trip_invite, name="trip-invite"),
    path("places/<int:place_id>/weather/", views.place_weather, name="place-weather"),
    path("trips/<int:trip_id>/weather/", views.trip_weather, name="trip-weather"),
    path("comments/", views.CommentViewSet.as_view({"get": "list", "post": "create"}), name="comment-list"),
    path("comments/<int:pk>/", views.CommentViewSet.as_view({"delete": "destroy"}), name="comment-detail"),
]
