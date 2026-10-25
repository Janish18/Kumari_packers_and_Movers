import uuid
from django.conf import settings
from rest_framework import serializers

from .models import UploadedFile

MAGIC = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG\r\n\x1a\n": "image/png"}


EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def sniff(head):
    for sig, ctype in MAGIC.items():
        if head.startswith(sig):
            return ctype
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def save_upload(user, f, purpose, booking=None):
    """Validate type (by content, not extension) and size, then store."""
    if f.size > settings.MAX_UPLOAD_BYTES:
        raise serializers.ValidationError({"file": "File is too large (max 5 MB)."})
    head = f.read(16)
    f.seek(0)
    ctype = sniff(head)
    if ctype not in settings.ALLOWED_UPLOAD_TYPES:
        raise serializers.ValidationError({"file": "Only JPEG, PNG or WebP images are allowed."})
    original = (f.name or "")[:200]
    # Never keep the client's file name/extension: store under a random name with an extension derived from the
    # sniffed content type, so an upload can never be served as HTML/JS and file names cannot be guessed.
    f.name = f"{uuid.uuid4().hex}{EXT[ctype]}"
    return UploadedFile.objects.create(
        owner=user, booking=booking, purpose=purpose, file=f, content_type=ctype,
        size_bytes=f.size, original_name=original,
    )
