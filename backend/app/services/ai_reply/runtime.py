import logging
from typing import Any, Optional

from backend.app.services.chat import (
    create_assistant_message,
    list_messages_for_conversation,
)

from .config import get_ai_reply_config
from .context import build_deepseek_messages
from .providers.deepseek import request_deepseek_reply

logger = logging.getLogger(__name__)


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
