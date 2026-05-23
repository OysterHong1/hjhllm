import unittest
from unittest.mock import patch

from backend.app.services.ai_reply import (
    build_deepseek_messages,
    maybe_create_ai_reply,
    parse_deepseek_response,
)


class AiReplyTest(unittest.TestCase):
    def test_build_deepseek_messages_includes_context_and_attachment_summary(self):
        messages = build_deepseek_messages(
            [
                {
                    "sender": "user",
                    "text": "你好",
                    "attachments": [],
                },
                {
                    "sender": "assistant",
                    "text": "你好，我在。",
                    "attachments": [],
                },
                {
                    "sender": "user",
                    "text": "",
                    "attachments": [{"kind": "image"}, {"kind": "image"}],
                },
            ],
            "system prompt",
        )

        self.assertEqual(messages[0], {"role": "system", "content": "system prompt"})
        self.assertEqual(messages[1], {"role": "user", "content": "你好"})
        self.assertEqual(messages[2], {"role": "assistant", "content": "你好，我在。"})
        self.assertEqual(messages[3], {"role": "user", "content": "[图片附件 x2]"})

    def test_parse_deepseek_response_returns_message_content(self):
        content = parse_deepseek_response(
            {"choices": [{"message": {"content": "  回复内容  "}}]}
        )

        self.assertEqual(content, "回复内容")

    def test_parse_deepseek_response_rejects_empty_choices(self):
        with self.assertRaises(ValueError):
            parse_deepseek_response({"choices": []})

    def test_maybe_create_ai_reply_swallows_provider_failure(self):
        with (
            patch(
                "backend.app.services.ai_reply.get_ai_reply_config",
                return_value={
                    "enabled": True,
                    "apiKey": "test-key",
                    "systemPrompt": "system",
                },
            ),
            patch(
                "backend.app.services.ai_reply.list_messages_for_conversation",
                return_value=[
                    {"sender": "user", "text": "你好", "attachments": []},
                ],
            ),
            patch(
                "backend.app.services.ai_reply.request_deepseek_reply",
                side_effect=RuntimeError("provider unavailable"),
            ),
            patch("backend.app.services.ai_reply.logger.exception"),
        ):
            self.assertIsNone(maybe_create_ai_reply("conversation-id"))


if __name__ == "__main__":
    unittest.main()
