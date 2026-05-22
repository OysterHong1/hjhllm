from fastapi import APIRouter

from backend.app.api.responses import fail, ok
from backend.app.infra.db import rows
from backend.app.services.formatting import now_iso

router = APIRouter()


@router.get("/api/health")
def health():
    try:
        rows("select 1")
        return ok({"service": "hjhllm", "database": "ok", "checkedAt": now_iso()})
    except Exception as error:
        return fail("database_unavailable", str(error), 503)
