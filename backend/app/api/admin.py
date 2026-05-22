from fastapi import APIRouter, Depends, Request

from backend.app.api.auth import verify_admin
from backend.app.api.responses import fail, ok
from backend.app.services.archive import create_archive_response
from backend.app.services.chat import (
    archive_admin_conversation,
    create_admin_message,
    get_admin_conversation,
    list_admin_conversations,
    reset_demo_data,
)

router = APIRouter(dependencies=[Depends(verify_admin)])


@router.get("/api/admin/conversations")
def admin_conversations():
    return ok({"conversations": list_admin_conversations()})


@router.get("/api/admin/conversations/{conversation_id}")
def admin_conversation(conversation_id: str):
    detail = get_admin_conversation(conversation_id)
    if not detail:
        return fail("not_found", "Conversation not found", 404)
    return ok(detail)


@router.post("/api/admin/conversations/{conversation_id}/messages")
async def admin_create_message(conversation_id: str, request: Request):
    body = await request.json()
    text = str(body.get("text", "")).strip()
    if not text:
        return fail("bad_request", "Message text is required")

    message = create_admin_message(conversation_id, text)
    if not message:
        return fail("not_found", "Conversation not found", 404)
    return ok({"message": message}, 201)


@router.post("/api/admin/conversations/{conversation_id}/archive")
def admin_archive_conversation(conversation_id: str):
    conversation = archive_admin_conversation(conversation_id)
    if not conversation:
        return fail("not_found", "Conversation not found", 404)
    return ok({"conversation": conversation})


@router.post("/api/admin/conversations/{conversation_id}/archive-local")
def admin_archive_local(conversation_id: str):
    response = create_archive_response(conversation_id)
    if not response:
        return fail("not_found", "Conversation not found", 404)
    return response


@router.post("/api/admin/reset-demo-data")
def admin_reset_demo_data():
    reset_demo_data()
    return ok({"reset": True})
