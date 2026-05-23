import logging
from typing import Any, Optional

from backend.app.services.chat import (
    create_assistant_message,
    list_messages_for_conversation,
)

from .config import get_ai_reply_config
from .context import build_deepseek_messages
from .providers.deepseek import request_deepseek_reply
from .usage import (
    DailyTokenLimitExceededError,
    record_daily_token_usage,
    release_token_reservation,
    reserve_daily_token_budget,
)

logger = logging.getLogger(__name__)


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
