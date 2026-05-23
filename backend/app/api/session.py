from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.app.api.responses import fail, ok
from backend.app.services.chat import create_user_session, restore_user_session

router = APIRouter()

SESSION_COOKIE_NAME = "hjhllm_user_id"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30


def with_session_cookie(response: JSONResponse, user_id: str) -> JSONResponse:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=user_id,
        max_age=SESSION_COOKIE_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return response


@router.post("/api/users/session")
async def users_session(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    user_id = str(body.get("userId", "")).strip()
    username = str(body.get("username", "")).strip()

    if not user_id:
        user_id = str(request.cookies.get(SESSION_COOKIE_NAME, "")).strip()

    if user_id:
        user = restore_user_session(user_id)
        if not user:
            return fail("not_found", "User session not found", 404)
        return with_session_cookie(ok({"user": user}), user["id"])

    if not username:
        return fail("bad_request", "username is required")

    user = create_user_session(username)
    return with_session_cookie(ok({"user": user}, 201), user["id"])
