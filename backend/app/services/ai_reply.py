import json
import logging
import urllib.error
import urllib.request
from typing import Any, Optional

from backend.app.config.settings import get_settings
from backend.app.infra.db import connection, rows
from backend.app.services.chat import (
    create_assistant_message,
    list_messages_for_conversation,
)
from backend.app.services.formatting import now_iso

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-v4-flash"
DEFAULT_SYSTEM_PROMPT = (
    "你是 HJH LLM 的自动回复助手。用自然、简洁、友好的中文回复用户。"
    "如果用户上传了附件但没有提供足够文字说明，请说明你目前只能基于文字内容回复。"
)
DEFAULT_REASONING_EFFORT = "high"
SETTING_KEYS = {
    "enabled": "ai_reply.enabled",
    "provider": "ai_reply.provider",
    "base_url": "ai_reply.base_url",
    "model": "ai_reply.model",
    "api_key": "ai_reply.api_key",
    "system_prompt": "ai_reply.system_prompt",
    "reasoning_effort": "ai_reply.reasoning_effort",
}
logger = logging.getLogger(__name__)


def ensure_settings_table() -> None:
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                create table if not exists app_settings (
                  key text primary key,
                  value text not null,
                  updated_at timestamptz not null default now()
                )
                """
            )


def _setting_rows() -> dict[str, str]:
    ensure_settings_table()
    result = rows(
        "select key, value from app_settings where key = any(%s)",
        (list(SETTING_KEYS.values()),),
    )
    return {row["key"]: row["value"] for row in result}


def _bool_value(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _bool_input(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _upsert_settings(values: dict[str, str]) -> None:
    ensure_settings_table()
    timestamp = now_iso()
    with connection() as conn:
        with conn.cursor() as cursor:
            for key, value in values.items():
                cursor.execute(
                    """
                    insert into app_settings (key, value, updated_at)
                    values (%s, %s, %s)
                    on conflict (key) do update
                    set value = excluded.value, updated_at = excluded.updated_at
                    """,
                    (key, value, timestamp),
                )


def get_ai_reply_config(include_secret: bool = False) -> dict[str, Any]:
    values = _setting_rows()
    api_key = values.get(SETTING_KEYS["api_key"], "") or get_settings().deepseek_api_key
    config = {
        "enabled": _bool_value(values.get(SETTING_KEYS["enabled"])),
        "provider": values.get(SETTING_KEYS["provider"], "deepseek"),
        "baseUrl": values.get(SETTING_KEYS["base_url"], DEFAULT_BASE_URL),
        "model": values.get(SETTING_KEYS["model"], DEFAULT_MODEL),
        "apiKeyConfigured": bool(api_key),
        "systemPrompt": values.get(SETTING_KEYS["system_prompt"], DEFAULT_SYSTEM_PROMPT),
        "reasoningEffort": values.get(
            SETTING_KEYS["reasoning_effort"], DEFAULT_REASONING_EFFORT
        ),
    }
    if include_secret:
        config["apiKey"] = api_key
    return config


def update_ai_reply_config(data: dict[str, Any]) -> dict[str, Any]:
    current = get_ai_reply_config(include_secret=True)
    next_enabled = _bool_input(data.get("enabled"), current["enabled"])
    next_api_key = str(data.get("apiKey", "")).strip() or current.get("apiKey", "")

    if next_enabled and not next_api_key:
        raise ValueError("missing_api_key")

    updates = {
        SETTING_KEYS["enabled"]: "true" if next_enabled else "false",
        SETTING_KEYS["provider"]: "deepseek",
        SETTING_KEYS["base_url"]: str(data.get("baseUrl", current["baseUrl"])).strip()
        or DEFAULT_BASE_URL,
        SETTING_KEYS["model"]: str(data.get("model", current["model"])).strip()
        or DEFAULT_MODEL,
        SETTING_KEYS["system_prompt"]: str(
            data.get("systemPrompt", current["systemPrompt"])
        ).strip()
        or DEFAULT_SYSTEM_PROMPT,
        SETTING_KEYS["reasoning_effort"]: str(
            data.get("reasoningEffort", current["reasoningEffort"])
        ).strip()
        or DEFAULT_REASONING_EFFORT,
    }
    if "apiKey" in data and str(data.get("apiKey", "")).strip():
        updates[SETTING_KEYS["api_key"]] = str(data["apiKey"]).strip()

    _upsert_settings(updates)
    return get_ai_reply_config()


def set_ai_reply_enabled(enabled: Any) -> dict[str, Any]:
    next_enabled = _bool_input(enabled)
    config = get_ai_reply_config(include_secret=True)
    if next_enabled and not config.get("apiKey"):
        raise ValueError("missing_api_key")
    _upsert_settings({SETTING_KEYS["enabled"]: "true" if next_enabled else "false"})
    return get_ai_reply_config()


def _attachment_summary(message: dict[str, Any]) -> str:
    attachments = message.get("attachments", [])
    if not attachments:
        return ""
    labels = {"image": "图片", "audio": "音频", "video": "视频"}
    counts: dict[str, int] = {}
    for attachment in attachments:
        kind = str(attachment.get("kind", ""))
        counts[kind] = counts.get(kind, 0) + 1
    return " ".join(
        f"[{labels.get(kind, kind)}附件 x{count}]" for kind, count in counts.items()
    )


def build_deepseek_messages(
    messages: list[dict[str, Any]], system_prompt: str
) -> list[dict[str, str]]:
    payload = [{"role": "system", "content": system_prompt}]
    for message in messages[-12:]:
        text = str(message.get("text") or "").strip()
        summary = _attachment_summary(message)
        content = " ".join(part for part in [text, summary] if part).strip()
        if not content:
            continue
        role = "user" if message.get("sender") == "user" else "assistant"
        payload.append({"role": role, "content": content})
    return payload


def parse_deepseek_response(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("DeepSeek response did not include choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise ValueError("DeepSeek response did not include message content")
    return content.strip()


def request_deepseek_reply(config: dict[str, Any], messages: list[dict[str, str]]) -> str:
    base_url = str(config["baseUrl"]).rstrip("/")
    url = f"{base_url}/chat/completions"
    body = {
        "model": config["model"],
        "messages": messages,
        "stream": False,
        "reasoning_effort": config["reasoningEffort"],
        "thinking": {"type": "enabled"},
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config['apiKey']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API returned {error.code}: {detail}") from error
    return parse_deepseek_response(data)


def maybe_create_ai_reply(conversation_id: str) -> Optional[dict[str, Any]]:
    try:
        config = get_ai_reply_config(include_secret=True)
        if not config["enabled"] or not config.get("apiKey"):
            return None

        messages = list_messages_for_conversation(conversation_id)
        if not messages or messages[-1]["sender"] != "user":
            return None

        payload = build_deepseek_messages(messages, config["systemPrompt"])
        if len(payload) <= 1:
            return None

        reply = request_deepseek_reply(config, payload)
        return create_assistant_message(conversation_id, reply)
    except Exception:
        logger.exception("AI auto-reply failed for conversation %s", conversation_id)
        return None
