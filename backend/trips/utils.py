"""
照片压缩工具。
上传时自动压缩：限制最大尺寸 1920px，JPEG 质量 80%。
"""

import io

from PIL import Image, ExifTags
from django.core.files.uploadedfile import InMemoryUploadedFile


def compress_image(uploaded_file, max_size=1920, quality=80):
    """
    压缩上传的图片。
    - max_size: 最长边不超过此像素
    - quality: JPEG 压缩质量（1-100）
    返回压缩后的 InMemoryUploadedFile
    """
    img = Image.open(uploaded_file)

    # 处理 EXIF 旋转信息（手机拍的照片可能有旋转标记）
    try:
        exif = img._getexif()
        if exif:
            for tag, value in exif.items():
                if ExifTags.TAGS.get(tag) == "Orientation":
                    if value == 3:
                        img = img.rotate(180, expand=True)
                    elif value == 6:
                        img = img.rotate(270, expand=True)
                    elif value == 8:
                        img = img.rotate(90, expand=True)
                    break
    except (AttributeError, TypeError):
        pass

    # 转为 RGB（去掉透明通道）
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # 等比缩放
    width, height = img.size
    if max(width, height) > max_size:
        if width > height:
            new_width = max_size
            new_height = int(height * max_size / width)
        else:
            new_height = max_size
            new_width = int(width * max_size / height)
        img = img.resize((new_width, new_height), Image.LANCZOS)

    # 压缩为 JPEG
    output = io.BytesIO()
    img.save(output, format="JPEG", quality=quality, optimize=True)
    output.seek(0)

    # 生成新文件名
    name = uploaded_file.name.rsplit(".", 1)[0] + ".jpg"

    return InMemoryUploadedFile(
        file=output,
        field_name="image",
        name=name,
        content_type="image/jpeg",
        size=output.getbuffer().nbytes,
        charset=None,
    )
