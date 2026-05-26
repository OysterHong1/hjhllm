import json

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import StreamingResponse

from backend.app.api.responses import fail, ok
from backend.app.services.chat import (
    create_conversation,
    create_user_message,
    list_messages_for_conversation,
    list_user_conversations,
    verify_conversation_owner,
)
from backend.app.services.ai_reply import maybe_create_ai_reply, stream_ai_reply_events

router = APIRouter()


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


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
async def create_message(
    conversation_id: str, request: Request, background_tasks: BackgroundTasks
):
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
    background_tasks.add_task(maybe_create_ai_reply, conversation_id)
    return ok({"message": message}, 201, background_tasks)


@router.post("/api/conversations/{conversation_id}/messages/stream")
async def create_message_stream(conversation_id: str, request: Request):
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

    def events():
        yield sse_event("message", {"message": message})
        for item in stream_ai_reply_events(conversation_id):
            yield sse_event(item["event"], item["data"])

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
