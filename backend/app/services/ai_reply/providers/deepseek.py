import json
import urllib.error
import urllib.request
from typing import Any


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
