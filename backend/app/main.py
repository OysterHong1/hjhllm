from fastapi import FastAPI, HTTPException

from backend.app.api import admin, attachments, conversations, health, session
from backend.app.api.responses import http_exception_handler

app = FastAPI(title="HJH LLM API")

app.add_exception_handler(HTTPException, http_exception_handler)
app.include_router(health.router)
app.include_router(session.router)
app.include_router(conversations.router)
app.include_router(attachments.router)
app.include_router(admin.router)
