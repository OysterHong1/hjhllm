from typing import Optional

from fastapi import Header, HTTPException

from backend.app.config.settings import get_settings


def verify_admin(authorization: Optional[str] = Header(default=None)) -> None:
    admin_token = get_settings().admin_api_token
    if not admin_token:
        raise HTTPException(status_code=500, detail="ADMIN_API_TOKEN is not configured")
    if authorization != f"Bearer {admin_token}":
        raise HTTPException(status_code=401, detail="Invalid admin token")
