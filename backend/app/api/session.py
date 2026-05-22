from fastapi import APIRouter, Request

from backend.app.api.responses import fail, ok
from backend.app.services.chat import create_user_session, restore_user_session

router = APIRouter()


@router.post("/api/users/session")
async def users_session(request: Request):
    body = await request.json()
    user_id = str(body.get("userId", "")).strip()
    username = str(body.get("username", "")).strip()

    if user_id:
        user = restore_user_session(user_id)
        if not user:
            return fail("not_found", "User session not found", 404)
        return ok({"user": user})

    if not username:
        return fail("bad_request", "username is required")

    return ok({"user": create_user_session(username)}, 201)
