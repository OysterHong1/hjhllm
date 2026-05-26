import json
import urllib.error
import urllib.request
from typing import Any, Iterator


def parse_deepseek_response(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("DeepSeek response did not include choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise ValueError("DeepSeek response did not include message content")
    return content.strip()


def parse_deepseek_usage(data: dict[str, Any]) -> dict[str, int]:
    usage = data.get("usage")
    if not isinstance(usage, dict):
        raise ValueError("DeepSeek response did not include usage")

    prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
    completion_tokens = int(usage.get("completion_tokens", 0) or 0)
    total_tokens = int(
        usage.get("total_tokens", prompt_tokens + completion_tokens)
        or prompt_tokens + completion_tokens
    )
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


def request_deepseek_reply(
    config: dict[str, Any],
    messages: list[dict[str, str]],
    max_completion_tokens: int | None = None,
) -> dict[str, Any]:
    base_url = str(config["baseUrl"]).rstrip("/")
    url = f"{base_url}/chat/completions"
    body = {
        "model": config["model"],
        "messages": messages,
        "stream": False,
        "reasoning_effort": config["reasoningEffort"],
        "thinking": {"type": "enabled"},
    }
    if max_completion_tokens is not None:
        body["max_tokens"] = max_completion_tokens
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
    return {
        "content": parse_deepseek_response(data),
        "usage": parse_deepseek_usage(data),
    }


def request_deepseek_reply_stream(
    config: dict[str, Any],
    messages: list[dict[str, str]],
    max_completion_tokens: int | None = None,
) -> Iterator[dict[str, Any]]:
    base_url = str(config["baseUrl"]).rstrip("/")
    url = f"{base_url}/chat/completions"
    body = {
        "model": config["model"],
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
        "reasoning_effort": config["reasoningEffort"],
        "thinking": {"type": "enabled"},
    }
    if max_completion_tokens is not None:
        body["max_tokens"] = max_completion_tokens
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
        with urllib.request.urlopen(request, timeout=120) as response:
            for raw_line in response:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                payload = line.removeprefix("data:").strip()
                if payload == "[DONE]":
                    break
                if not payload:
                    continue
                data = json.loads(payload)
                usage = data.get("usage")
                if isinstance(usage, dict):
                    yield {"type": "usage", "usage": parse_deepseek_usage(data)}

                choices = data.get("choices")
                if not isinstance(choices, list):
                    continue
                for choice in choices:
                    delta = choice.get("delta") if isinstance(choice, dict) else None
                    content = delta.get("content") if isinstance(delta, dict) else None
                    if isinstance(content, str) and content:
                        yield {"type": "delta", "content": content}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API returned {error.code}: {detail}") from error
