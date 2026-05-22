import re
import struct
import time
import zlib
from urllib.parse import quote

from fastapi.responses import Response

from backend.app.infra.storage import (
    MEDIA_DIR_BY_KIND,
    attachment_file_path,
    extension_for_attachment,
)
from backend.app.services.chat import get_admin_conversation
from backend.app.services.formatting import now_iso


def safe_segment(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|#%{}\[\]^~`]+', "-", value.strip())
    cleaned = re.sub(r"\s+", "-", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    return (cleaned or "untitled")[:80]


def make_zip(entries: list[tuple[str, bytes]]) -> bytes:
    local_parts: list[bytes] = []
    central_parts: list[bytes] = []
    offset = 0
    timestamp = time.localtime()
    dos_time = (timestamp.tm_hour << 11) | (timestamp.tm_min << 5) | (
        timestamp.tm_sec // 2
    )
    dos_date = (
        ((timestamp.tm_year - 1980) << 9)
        | (timestamp.tm_mon << 5)
        | timestamp.tm_mday
    )

    for name, data in entries:
        name_bytes = name.encode("utf-8")
        checksum = zlib.crc32(data) & 0xFFFFFFFF
        local = struct.pack(
            "<IHHHHHIIIHH",
            0x04034B50,
            20,
            0x0800,
            0,
            dos_time,
            dos_date,
            checksum,
            len(data),
            len(data),
            len(name_bytes),
            0,
        )
        local_parts.extend([local, name_bytes, data])
        central = struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014B50,
            20,
            20,
            0x0800,
            0,
            dos_time,
            dos_date,
            checksum,
            len(data),
            len(data),
            len(name_bytes),
            0,
            0,
            0,
            0,
            0,
            offset,
        )
        central_parts.extend([central, name_bytes])
        offset += len(local) + len(name_bytes) + len(data)

    central_directory = b"".join(central_parts)
    end = struct.pack(
        "<IHHHHIIH",
        0x06054B50,
        0,
        0,
        len(entries),
        len(entries),
        len(central_directory),
        offset,
        0,
    )
    return b"".join(local_parts) + central_directory + end


def create_archive_response(conversation_id: str):
    detail = get_admin_conversation(conversation_id)
    if not detail:
        return None

    conversation = detail["conversation"]
    archived_at = now_iso()
    base_name = "_".join(
        [
            archived_at.replace(":", "-")
            .replace(".", "-")
            .replace("T", "_")
            .replace("Z", ""),
            safe_segment(
                (conversation.get("user") or {}).get("username")
                or conversation["userId"]
            ),
            safe_segment(conversation["title"]),
            conversation["id"][:8],
        ]
    )

    entries: list[tuple[str, bytes]] = [
        ("img/", b""),
        ("voice/", b""),
        ("video/", b""),
    ]
    lines = [
        f"# {conversation['title']}",
        "",
        "## 会话信息",
        "",
        f"- 会话 ID: `{conversation['id']}`",
        f"- 用户 ID: `{conversation['userId']}`",
        f"- 用户名: {(conversation.get('user') or {}).get('username') or '未知用户'}",
        f"- 状态: {conversation['status']}",
        f"- 创建时间: {conversation['createdAt']}",
        f"- 更新时间: {conversation['updatedAt']}",
        f"- 本地归档时间: {archived_at}",
        "",
        "## 消息记录",
        "",
    ]
    media_count = 0
    failed_count = 0

    for message_index, message in enumerate(detail["messages"]):
        sender = {"user": "用户", "admin": "管理员"}.get(message["sender"], "助手")
        lines.extend(
            [
                f"### {message_index + 1}. {sender} · {message['createdAt']}",
                "",
                message["text"].strip() or "_无文字内容_",
                "",
            ]
        )
        if message["attachments"]:
            lines.extend(["| 类型 | 文件 | MIME | 大小 |", "| --- | --- | --- | --- |"])

        for attachment_index, attachment in enumerate(message["attachments"]):
            relative_path = (
                f"{MEDIA_DIR_BY_KIND[attachment['kind']]}/"
                f"{message_index + 1:03d}-{attachment_index + 1:02d}-{attachment['id']}"
                f"{extension_for_attachment(attachment)}"
            )
            try:
                data = attachment_file_path(attachment["storagePath"]).read_bytes()
                entries.append((relative_path, data))
                media_count += 1
                file_cell = f"[{relative_path}]({relative_path})"
            except Exception as error:
                failed_count += 1
                file_cell = f"下载失败: {error}"
            lines.append(
                f"| {attachment['kind']} | {file_cell} | {attachment['mimeType']} | {attachment['size']} |"
            )
        lines.append("")

    entries.append(("conversation.md", "\n".join(lines).encode("utf-8")))
    data = make_zip(entries)
    filename = f"{base_name}.zip"
    return Response(
        data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "X-Archive-Filename": quote(filename),
            "X-Archive-Media-Count": str(media_count),
            "X-Archive-Failed-Media-Count": str(failed_count),
        },
    )
