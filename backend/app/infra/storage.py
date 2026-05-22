import re
from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException

from backend.app.config.settings import get_settings

ATTACHMENT_MAX_BYTES = {
    "image": 10 * 1024 * 1024,
    "audio": 20 * 1024 * 1024,
    "video": 50 * 1024 * 1024,
}

EXTENSION_BY_MIME_TYPE = {
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}

MEDIA_DIR_BY_KIND = {
    "image": "img",
    "audio": "voice",
    "video": "video",
}


def attachment_url(storage_path: str) -> str:
    encoded = "/".join(quote(segment) for segment in storage_path.split("/"))
    return f"/api/attachments/files/{encoded}"


def safe_storage_path(storage_path: str) -> str:
    normalized = storage_path.replace("\\", "/")
    parts = normalized.split("/")
    if normalized.startswith("/") or ".." in parts or "" in parts:
        raise HTTPException(status_code=404, detail="Invalid attachment path")
    return normalized


def attachment_file_path(storage_path: str) -> Path:
    return get_settings().attachment_storage_dir / safe_storage_path(storage_path)


def extension_for_filename(file_name: str) -> str:
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if re.fullmatch(r"[a-z0-9]{1,12}", extension):
        return f".{extension}"
    return ""


def extension_for_attachment(attachment: dict) -> str:
    if attachment["mimeType"] in EXTENSION_BY_MIME_TYPE:
        return EXTENSION_BY_MIME_TYPE[attachment["mimeType"]]
    file_name = attachment["storagePath"].rsplit("/", 1)[-1]
    return extension_for_filename(file_name)
