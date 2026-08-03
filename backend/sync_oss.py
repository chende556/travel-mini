import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

media_root = settings.MEDIA_ROOT

if not os.path.exists(media_root):
    print("Media root does not exist.")
    exit(0)

for root, dirs, files in os.walk(media_root):
    for file in files:
        if file == '.DS_Store':
            continue
        local_path = os.path.join(root, file)
        relative_path = os.path.relpath(local_path, media_root)
        # Ensure path uses forward slashes
        relative_path = relative_path.replace("\\", "/")
        
        print(f"Uploading {relative_path}...")
        with open(local_path, 'rb') as f:
            content = f.read()
            if not default_storage.exists(relative_path):
                default_storage.save(relative_path, ContentFile(content))
                print(f"Successfully uploaded {relative_path}")
            else:
                print(f"File {relative_path} already exists in OSS.")

print("All local media synced to OSS.")
