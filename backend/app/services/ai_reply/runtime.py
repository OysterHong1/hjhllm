import logging
from typing import Any, Iterator, Optional

from backend.app.services.chat import (
    create_assistant_message,
    list_messages_for_conversation,
)
from backend.app.services.llm.providers.deepseek import (
    request_deepseek_reply,
    request_deepseek_reply_stream,
)

from .config import get_ai_reply_config
from .context import build_deepseek_messages
from .usage import (
    DailyTokenLimitExceededError,
    record_daily_token_usage,
    release_token_reservation,
    reserve_daily_token_budget,
)

logger = logging.getLogger(__name__)


def estimate_completion_usage(
    reservation: Any, content: str
) -> dict[str, int]:
    completion_tokens = max(1, len(content) // 4)
    prompt_tokens = int(getattr(reservation, "prompt_estimate_tokens", 0) or 0)
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


def maybe_create_ai_reply(conversation_id: str) -> Optional[dict[str, Any]]:
    reservation = None
    reply_requested = False
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

        reservation = reserve_daily_token_budget(payload, config["dailyTokenLimit"])
        reply = request_deepseek_reply(
            config,
            payload,
            reservation.max_completion_tokens if reservation else None,
        )
        reply_requested = True
        record_daily_token_usage(reply["usage"], reservation.id if reservation else None)
        return create_assistant_message(conversation_id, reply["content"])
    except DailyTokenLimitExceededError as error:
        logger.warning(
            "AI auto-reply skipped for conversation %s: %s", conversation_id, error
        )
        return None
    except Exception:
        if reservation and not reply_requested:
            release_token_reservation(reservation.id)
        logger.exception("AI auto-reply failed for conversation %s", conversation_id)
        return None


def stream_ai_reply_events(conversation_id: str) -> Iterator[dict[str, Any]]:
    reservation = None
    content_parts: list[str] = []
    usage_recorded = False
    try:
        config = get_ai_reply_config(include_secret=True)
        if not config["enabled"] or not config.get("apiKey"):
            yield {"event": "done", "data": {"message": None}}
            return

        messages = list_messages_for_conversation(conversation_id)
        if not messages or messages[-1]["sender"] != "user":
            yield {"event": "done", "data": {"message": None}}
            return

        payload = build_deepseek_messages(messages, config["systemPrompt"])
        if len(payload) <= 1:
            yield {"event": "done", "data": {"message": None}}
            return

        reservation = reserve_daily_token_budget(payload, config["dailyTokenLimit"])
        for chunk in request_deepseek_reply_stream(
            config,
            payload,
            reservation.max_completion_tokens if reservation else None,
        ):
            if chunk["type"] == "delta":
                content = str(chunk["content"])
                content_parts.append(content)
                yield {"event": "delta", "data": {"text": content}}
            if chunk["type"] == "usage":
                record_daily_token_usage(
                    chunk["usage"], reservation.id if reservation else None
                )
                usage_recorded = True

        content = "".join(content_parts).strip()
        if reservation and not usage_recorded:
            if content:
                record_daily_token_usage(
                    estimate_completion_usage(reservation, content), reservation.id
                )
            else:
                release_token_reservation(reservation.id)

        message = create_assistant_message(conversation_id, content) if content else None
        yield {"event": "done", "data": {"message": message}}
    except DailyTokenLimitExceededError as error:
        logger.warning(
            "AI streaming reply skipped for conversation %s: %s", conversation_id, error
        )
        yield {"event": "error", "data": {"message": "今日 AI 自动回复额度已用完"}}
    except Exception:
        if reservation and not usage_recorded:
            release_token_reservation(reservation.id)
        logger.exception("AI streaming reply failed for conversation %s", conversation_id)
        yield {"event": "error", "data": {"message": "AI 自动回复失败，请稍后再试"}}
