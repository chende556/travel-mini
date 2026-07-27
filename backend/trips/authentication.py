"""
微信小程序认证。
通过请求头 Authorization: Bearer <token> 识别用户。
token 就是用户的 openid（简化方案，生产环境可用 JWT）。
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User


class WeChatAuthentication(BaseAuthentication):
    """从 Authorization header 中提取 token（openid）认证用户"""

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")

        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:].strip()
        if not token:
            return None

        try:
            user = User.objects.get(openid=token)
        except User.DoesNotExist:
            raise AuthenticationFailed("用户不存在")

        return (user, token)
