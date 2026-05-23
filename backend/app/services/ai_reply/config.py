from typing import Any, Optional

from backend.app.config.settings import get_settings
from backend.app.infra.db import connection, rows
from backend.app.services.formatting import now_iso

from .constants import (
    DEFAULT_BASE_URL,
    DEFAULT_DAILY_TOKEN_LIMIT,
    DEFAULT_MODEL,
    DEFAULT_REASONING_EFFORT,
    DEFAULT_SYSTEM_PROMPT,
    SETTING_KEYS,
)
from .usage import get_today_token_usage_snapshot


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


def bool_input(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def int_input(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, str) and not value.strip():
        return default
    parsed = int(str(value).strip())
    if parsed < 0:
        raise ValueError("invalid_non_negative_int")
    return parsed


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
    daily_token_limit = int_input(
        values.get(SETTING_KEYS["daily_token_limit"]), DEFAULT_DAILY_TOKEN_LIMIT
    )
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
        "dailyTokenLimit": daily_token_limit,
        "todayUsage": get_today_token_usage_snapshot(daily_token_limit),
    }
    if include_secret:
        config["apiKey"] = api_key
    return config


def update_ai_reply_config(data: dict[str, Any]) -> dict[str, Any]:
    current = get_ai_reply_config(include_secret=True)
    next_enabled = bool_input(data.get("enabled"), current["enabled"])
    next_api_key = str(data.get("apiKey", "")).strip() or current.get("apiKey", "")
    try:
        next_daily_token_limit = int_input(
            data.get("dailyTokenLimit"), current["dailyTokenLimit"]
        )
    except ValueError as error:
        if str(error) == "invalid_non_negative_int":
            raise ValueError("invalid_daily_token_limit") from error
        raise

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
        SETTING_KEYS["daily_token_limit"]: str(next_daily_token_limit),
    }
    if "apiKey" in data and str(data.get("apiKey", "")).strip():
        updates[SETTING_KEYS["api_key"]] = str(data["apiKey"]).strip()

    _upsert_settings(updates)
    return get_ai_reply_config()


def set_ai_reply_enabled(enabled: Any) -> dict[str, Any]:
    next_enabled = bool_input(enabled)
    config = get_ai_reply_config(include_secret=True)
    if next_enabled and not config.get("apiKey"):
        raise ValueError("missing_api_key")
    _upsert_settings({SETTING_KEYS["enabled"]: "true" if next_enabled else "false"})
    return get_ai_reply_config()
