from typing import Any


def attachment_summary(message: dict[str, Any]) -> str:
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


def build_chat_messages(
    messages: list[dict[str, Any]], system_prompt: str
) -> list[dict[str, str]]:
    payload = [{"role": "system", "content": system_prompt}]
    for message in messages[-12:]:
        text = str(message.get("text") or "").strip()
        summary = attachment_summary(message)
        content = " ".join(part for part in [text, summary] if part).strip()
        if not content:
            continue
        role = "user" if message.get("sender") == "user" else "assistant"
        payload.append({"role": role, "content": content})
    return payload


def build_deepseek_messages(
    messages: list[dict[str, Any]], system_prompt: str
) -> list[dict[str, str]]:
    return build_chat_messages(messages, system_prompt)
