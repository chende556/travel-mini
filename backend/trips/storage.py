import os
import oss2
from django.conf import settings
from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible

@deconstructible
class OSS2Storage(Storage):
    def __init__(self):
        auth = oss2.Auth(settings.ALIYUN_OSS_ACCESS_KEY_ID, settings.ALIYUN_OSS_ACCESS_KEY_SECRET)
        self.bucket = oss2.Bucket(auth, settings.ALIYUN_OSS_ENDPOINT, settings.ALIYUN_OSS_BUCKET_NAME)
        # 兼容旧版本：有的时候 endpoint 是带有 http 的，有的时候没有
        endpoint = settings.ALIYUN_OSS_ENDPOINT
        if endpoint.startswith('http://'):
            endpoint = endpoint[7:]
        elif endpoint.startswith('https://'):
            endpoint = endpoint[8:]
        self.base_url = f"https://{settings.ALIYUN_OSS_BUCKET_NAME}.{endpoint}"

    def _open(self, name, mode='rb'):
        try:
            content = self.bucket.get_object(name).read()
            return ContentFile(content)
        except oss2.exceptions.NoSuchKey:
            raise FileNotFoundError(f"File {name} does not exist in OSS")

    def _save(self, name, content):
        # 阿里云 OSS 保存文件
        content.seek(0)
        self.bucket.put_object(name, content.read())
        return name

    def exists(self, name):
        try:
            return self.bucket.object_exists(name)
        except Exception:
            return False

    def size(self, name):
        return self.bucket.head_object(name).content_length

    def url(self, name):
        return f"{self.base_url}/{name}"

    def delete(self, name):
        self.bucket.delete_object(name)
