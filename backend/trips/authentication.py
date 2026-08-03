"""
微信小程序认证。
通过请求头 Authorization: Bearer <token> 识别用户。
使用 TimestampSigner 生成带过期时间的 token，替代直接暴露 openid。
"""

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User

# Token 过期时间（秒），默认 30 天
TOKEN_MAX_AGE = getattr(settings, "TOKEN_MAX_AGE", 30 * 24 * 3600)


def generate_token(user):
    """为用户生成带时间戳签名的 token"""
    signer = TimestampSigner()
    return signer.sign(str(user.id))


def verify_token(token):
    """验证 token，返回 user_id；过期或无效则抛异常"""
    signer = TimestampSigner()
    try:
        user_id = signer.unsign(token, max_age=TOKEN_MAX_AGE)
        return int(user_id)
    except SignatureExpired:
        raise AuthenticationFailed("登录已过期，请重新登录")
    except BadSignature:
        raise AuthenticationFailed("无效的认证信息")


class WeChatAuthentication(BaseAuthentication):
    """从 Authorization header 中提取签名 token 认证用户"""

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")

        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:].strip()
        if not token:
            return None

        user_id = verify_token(token)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("用户不存在")

        return (user, token)
