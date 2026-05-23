from typing import Any, Optional, Union

from starlette.background import BackgroundTask, BackgroundTasks
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def ok(
    data: Any,
    status_code: int = 200,
    background: Optional[Union[BackgroundTask, BackgroundTasks]] = None,
) -> JSONResponse:
    return JSONResponse(
        {"ok": True, "data": data}, status_code=status_code, background=background
    )


def fail(code: str, message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "error": {"code": code, "message": message}},
        status_code=status_code,
    )


async def http_exception_handler(
    _request: Request, exc: HTTPException
) -> JSONResponse:
    code = "internal_error"
    if exc.status_code == 400:
        code = "bad_request"
    if exc.status_code == 401:
        code = "unauthorized"
    if exc.status_code == 404:
        code = "not_found"
    return fail(code, str(exc.detail), exc.status_code)
