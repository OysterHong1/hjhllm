from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.app.api.responses import fail, ok
from backend.app.infra.db import one
from backend.app.infra.storage import attachment_file_path, safe_storage_path
from backend.app.services.ai_reply import maybe_create_ai_reply
from backend.app.services.chat import create_attachment_message

router = APIRouter()


@router.post("/api/attachments")
async def create_message_with_attachments(
    background_tasks: BackgroundTasks,
    conversationId: str = Form(...),
    userId: str = Form(...),
    text: str = Form(default=""),
    durationMs: Optional[int] = Form(default=None),
    files: Optional[list[UploadFile]] = File(default=None),
    file: Optional[list[UploadFile]] = File(default=None),
):
    uploads = [*(files or []), *(file or [])]
    user_id = userId.strip()
    conversation_id = conversationId.strip()
    if not user_id:
        return fail("bad_request", "userId is required")
    if not conversation_id:
        return fail("bad_request", "conversationId is required")
    if not uploads:
        return fail("bad_request", "file is required")

    try:
        message = await create_attachment_message(
            conversation_id, user_id, text, uploads, durationMs
        )
    except ValueError as error:
        code = str(error)
        if code == "unsupported_media_type":
            return fail("unsupported_media_type", "Unsupported attachment type", 415)
        if code == "empty_attachment":
            return fail("bad_request", "Attachment cannot be empty")
        if code == "attachment_too_large":
            return fail("payload_too_large", "Attachment is too large", 413)
        raise

    if not message:
        return fail("not_found", "Conversation not found", 404)
    background_tasks.add_task(maybe_create_ai_reply, conversation_id)
    return ok({"message": message}, 201, background_tasks)


@router.get("/api/attachments/files/{storage_path:path}")
def get_attachment_file(storage_path: str):
    safe_path = safe_storage_path(storage_path)
    file_path = attachment_file_path(safe_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")
    metadata = one(
        "select mime_type from attachments where storage_path = %s limit 1",
        (safe_path,),
    )
    return FileResponse(file_path, media_type=metadata["mime_type"] if metadata else None)
