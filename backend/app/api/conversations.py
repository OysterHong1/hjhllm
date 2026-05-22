from fastapi import APIRouter, Request

from backend.app.api.responses import fail, ok
from backend.app.services.chat import (
    create_conversation,
    create_user_message,
    list_messages_for_conversation,
    list_user_conversations,
    verify_conversation_owner,
)

router = APIRouter()


@router.get("/api/conversations")
def list_conversations(userId: str):
    return ok({"conversations": list_user_conversations(userId.strip())})


@router.post("/api/conversations")
async def create_user_conversation(request: Request):
    body = await request.json()
    user_id = str(body.get("userId", "")).strip()
    title = str(body.get("title", "")).strip() or "新的会话"
    if not user_id:
        return fail("bad_request", "userId is required")
    return ok({"conversation": create_conversation(user_id, title)}, 201)


@router.get("/api/conversations/{conversation_id}/messages")
def list_user_messages(conversation_id: str, userId: str):
    if not verify_conversation_owner(conversation_id, userId.strip()):
        return fail("not_found", "Conversation not found", 404)
    return ok({"messages": list_messages_for_conversation(conversation_id)})


@router.post("/api/conversations/{conversation_id}/messages")
async def create_message(conversation_id: str, request: Request):
    body = await request.json()
    user_id = str(body.get("userId", "")).strip()
    text = str(body.get("text", "")).strip()
    if not user_id:
        return fail("bad_request", "userId is required")
    if not text:
        return fail("bad_request", "Message text is required")

    message = create_user_message(conversation_id, user_id, text)
    if not message:
        return fail("not_found", "Conversation not found", 404)
    return ok({"message": message}, 201)
