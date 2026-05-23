import re
from typing import Any, Literal, Optional

from fastapi import UploadFile

from backend.app.infra.db import connection, execute, one, rows
from backend.app.infra.storage import (
    ATTACHMENT_MAX_BYTES,
    attachment_file_path,
    attachment_url,
    extension_for_filename,
)
from backend.app.services.formatting import as_iso, create_id, now_iso


def to_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "createdAt": as_iso(row["created_at"]),
        "lastSeenAt": as_iso(row["last_seen_at"]),
    }


def to_conversation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "title": row["title"],
        "status": row["status"],
        "createdAt": as_iso(row["created_at"]),
        "updatedAt": as_iso(row["updated_at"]),
    }


def to_attachment(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "messageId": row["message_id"],
        "kind": row["kind"],
        "storagePath": row["storage_path"],
        "url": attachment_url(row["storage_path"]),
        "mimeType": row["mime_type"],
        "size": row["size"],
        "durationMs": row["duration_ms"],
        "width": row["width"],
        "height": row["height"],
        "thumbnailUrl": row["thumbnail_url"],
        "createdAt": as_iso(row["created_at"]),
    }


def to_message(
    row: dict[str, Any], attachments: Optional[list[dict[str, Any]]] = None
) -> dict[str, Any]:
    return {
        "id": row["id"],
        "conversationId": row["conversation_id"],
        "sender": row["sender"],
        "text": row["text"],
        "attachments": [to_attachment(attachment) for attachment in attachments or []],
        "createdAt": as_iso(row["created_at"]),
    }


def make_conversation_title(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    return f"{cleaned[:20]}..." if len(cleaned) > 20 else cleaned


def attachment_kind(mime_type: str) -> Optional[Literal["image", "audio", "video"]]:
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("audio/"):
        return "audio"
    if mime_type.startswith("video/"):
        return "video"
    return None


def verify_conversation_owner(
    conversation_id: str, user_id: str
) -> Optional[dict[str, Any]]:
    return one(
        """
        select id, user_id, title, status, created_at, updated_at
        from conversations
        where id = %s and user_id = %s
        """,
        (conversation_id, user_id),
    )


def create_user_session(username: str) -> dict[str, Any]:
    timestamp = now_iso()
    user = one(
        """
        insert into users (id, username, created_at, last_seen_at)
        values (%s, %s, %s, %s)
        returning id, username, created_at, last_seen_at
        """,
        (create_id(), username, timestamp, timestamp),
    )
    return to_user(user)


def restore_user_session(user_id: str) -> Optional[dict[str, Any]]:
    user = one(
        """
        update users set last_seen_at = %s
        where id = %s
        returning id, username, created_at, last_seen_at
        """,
        (now_iso(), user_id),
    )
    return to_user(user) if user else None


def list_user_conversations(user_id: str) -> list[dict[str, Any]]:
    result = rows(
        """
        select id, user_id, title, status, created_at, updated_at
        from conversations
        where user_id = %s and status = 'open'
        order by updated_at desc
        """,
        (user_id,),
    )
    return [to_conversation(row) for row in result]


def create_conversation(user_id: str, title: str = "新的会话") -> dict[str, Any]:
    timestamp = now_iso()
    row = one(
        """
        insert into conversations (id, user_id, title, status, created_at, updated_at)
        values (%s, %s, %s, 'open', %s, %s)
        returning id, user_id, title, status, created_at, updated_at
        """,
        (create_id(), user_id, title, timestamp, timestamp),
    )
    return to_conversation(row)


def get_attachments(message_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    if not message_ids:
        return {}
    result = rows(
        """
        select id, message_id, kind, storage_path, url, mime_type, size,
               duration_ms, width, height, thumbnail_url, created_at
        from attachments
        where message_id = any(%s)
        order by created_at asc
        """,
        (message_ids,),
    )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in result:
        grouped.setdefault(row["message_id"], []).append(row)
    return grouped


def list_messages_for_conversation(conversation_id: str) -> list[dict[str, Any]]:
    message_rows = rows(
        """
        select id, conversation_id, sender, text, created_at
        from messages
        where conversation_id = %s
        order by created_at asc
        """,
        (conversation_id,),
    )
    attachments = get_attachments([row["id"] for row in message_rows])
    return [to_message(row, attachments.get(row["id"], [])) for row in message_rows]


def create_user_message(
    conversation_id: str, user_id: str, text: str
) -> Optional[dict[str, Any]]:
    if not verify_conversation_owner(conversation_id, user_id):
        return None

    timestamp = now_iso()
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                insert into messages (id, conversation_id, sender, text, created_at)
                values (%s, %s, 'user', %s, %s)
                returning id, conversation_id, sender, text, created_at
                """,
                (create_id(), conversation_id, text, timestamp),
            )
            message = cursor.fetchone()
            cursor.execute(
                """
                update conversations
                set updated_at = %s,
                    title = case when title = '新的会话' then %s else title end
                where id = %s
                """,
                (timestamp, make_conversation_title(text), conversation_id),
            )
    return to_message(message)


def get_users_by_id(user_ids: list[str]) -> dict[str, dict[str, Any]]:
    unique_ids = sorted(set(user_ids))
    if not unique_ids:
        return {}
    user_rows = rows(
        "select id, username, created_at, last_seen_at from users where id = any(%s)",
        (unique_ids,),
    )
    return {row["id"]: to_user(row) for row in user_rows}


def get_last_senders(conversation_ids: list[str]) -> dict[str, str]:
    unique_ids = sorted(set(conversation_ids))
    if not unique_ids:
        return {}
    sender_rows = rows(
        """
        select distinct on (conversation_id) conversation_id, sender
        from messages
        where conversation_id = any(%s)
        order by conversation_id, created_at desc
        """,
        (unique_ids,),
    )
    return {row["conversation_id"]: row["sender"] for row in sender_rows}


def list_admin_conversations() -> list[dict[str, Any]]:
    conversation_rows = rows(
        """
        select id, user_id, title, status, created_at, updated_at
        from conversations
        where status = 'open'
        order by updated_at desc
        """
    )
    users = get_users_by_id([row["user_id"] for row in conversation_rows])
    last_senders = get_last_senders([row["id"] for row in conversation_rows])
    conversations = []
    for row in conversation_rows:
        conversation = to_conversation(row)
        conversation["user"] = users.get(row["user_id"])
        conversation["needsReply"] = last_senders.get(row["id"]) == "user"
        conversations.append(conversation)
    return sorted(
        conversations,
        key=lambda item: (item["needsReply"], item["updatedAt"]),
        reverse=True,
    )


def get_admin_conversation(conversation_id: str) -> Optional[dict[str, Any]]:
    conversation = one(
        """
        select id, user_id, title, status, created_at, updated_at
        from conversations
        where id = %s
        """,
        (conversation_id,),
    )
    if not conversation:
        return None

    user = get_users_by_id([conversation["user_id"]]).get(conversation["user_id"])
    last_sender = get_last_senders([conversation["id"]]).get(conversation["id"])
    data = to_conversation(conversation)
    data["user"] = user
    data["needsReply"] = last_sender == "user"
    return {"conversation": data, "messages": list_messages_for_conversation(conversation_id)}


def create_admin_message(conversation_id: str, text: str) -> Optional[dict[str, Any]]:
    if not get_admin_conversation(conversation_id):
        return None

    timestamp = now_iso()
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                insert into messages (id, conversation_id, sender, text, created_at)
                values (%s, %s, 'admin', %s, %s)
                returning id, conversation_id, sender, text, created_at
                """,
                (create_id(), conversation_id, text, timestamp),
            )
            message = cursor.fetchone()
            cursor.execute(
                "update conversations set updated_at = %s where id = %s",
                (timestamp, conversation_id),
            )
    return to_message(message)


def create_assistant_message(conversation_id: str, text: str) -> Optional[dict[str, Any]]:
    if not get_admin_conversation(conversation_id):
        return None

    timestamp = now_iso()
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                insert into messages (id, conversation_id, sender, text, created_at)
                values (%s, %s, 'assistant', %s, %s)
                returning id, conversation_id, sender, text, created_at
                """,
                (create_id(), conversation_id, text, timestamp),
            )
            message = cursor.fetchone()
            cursor.execute(
                "update conversations set updated_at = %s where id = %s",
                (timestamp, conversation_id),
            )
    return to_message(message)


def archive_admin_conversation(conversation_id: str) -> Optional[dict[str, Any]]:
    conversation = one(
        """
        update conversations
        set status = 'archived', updated_at = %s
        where id = %s
        returning id, user_id, title, status, created_at, updated_at
        """,
        (now_iso(), conversation_id),
    )
    return to_conversation(conversation) if conversation else None


async def create_attachment_message(
    conversation_id: str,
    user_id: str,
    text: str,
    uploads: list[UploadFile],
    duration_ms: Optional[int],
) -> Optional[dict[str, Any]]:
    if not verify_conversation_owner(conversation_id, user_id):
        return None

    uploaded: list[dict[str, Any]] = []
    try:
        for upload in uploads:
            mime_type = upload.content_type or "application/octet-stream"
            kind = attachment_kind(mime_type)
            if not kind:
                raise ValueError("unsupported_media_type")

            data = await upload.read()
            if len(data) == 0:
                raise ValueError("empty_attachment")
            if len(data) > ATTACHMENT_MAX_BYTES[kind]:
                raise ValueError("attachment_too_large")

            storage_path = "/".join(
                [
                    user_id,
                    conversation_id,
                    f"{create_id()}{extension_for_filename(upload.filename or 'attachment')}",
                ]
            )
            file_path = attachment_file_path(storage_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(data)
            uploaded.append(
                {
                    "id": create_id(),
                    "kind": kind,
                    "storage_path": storage_path,
                    "url": attachment_url(storage_path),
                    "mime_type": mime_type,
                    "size": len(data),
                    "duration_ms": duration_ms if kind == "audio" else None,
                }
            )

        with connection() as conn:
            with conn.cursor() as cursor:
                message_id = create_id()
                timestamp = now_iso()
                cursor.execute(
                    """
                    insert into messages (id, conversation_id, sender, text, created_at)
                    values (%s, %s, 'user', %s, %s)
                    returning id, conversation_id, sender, text, created_at
                    """,
                    (message_id, conversation_id, text.strip(), timestamp),
                )
                message = cursor.fetchone()
                attachment_rows = []
                for item in uploaded:
                    cursor.execute(
                        """
                        insert into attachments (
                          id, message_id, kind, storage_path, url, mime_type, size,
                          duration_ms, created_at
                        )
                        values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        returning id, message_id, kind, storage_path, url, mime_type,
                                  size, duration_ms, width, height, thumbnail_url, created_at
                        """,
                        (
                            item["id"],
                            message_id,
                            item["kind"],
                            item["storage_path"],
                            item["url"],
                            item["mime_type"],
                            item["size"],
                            item["duration_ms"],
                            timestamp,
                        ),
                    )
                    attachment_rows.append(cursor.fetchone())
                cursor.execute(
                    """
                    update conversations
                    set updated_at = %s,
                        title = case when title = '新的会话' then %s else title end
                    where id = %s
                    """,
                    (
                        timestamp,
                        make_conversation_title(text or uploads[0].filename or "附件消息"),
                        conversation_id,
                    ),
                )
        return to_message(message, attachment_rows)
    except Exception:
        for item in uploaded:
            attachment_file_path(item["storage_path"]).unlink(missing_ok=True)
        raise


def reset_demo_data() -> None:
    attachment_rows = rows("select storage_path from attachments")
    execute("delete from users where id <> ''")
    for item in attachment_rows:
        attachment_file_path(item["storage_path"]).unlink(missing_ok=True)
