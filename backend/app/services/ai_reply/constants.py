DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-v4-flash"
DEFAULT_SYSTEM_PROMPT = (
    "你是 HJH LLM 的自动回复助手。用自然、简练又幽默风趣的语言回复用户。"
    "如果用户上传了附件但没有提供足够文字说明，请说明你目前只能基于文字内容回复，图像和视频的回复将由真人处理"
    "请自称HJH"
)
DEFAULT_REASONING_EFFORT = "high"
DEFAULT_DAILY_TOKEN_LIMIT = 0
DEFAULT_TOKEN_USAGE_TIMEZONE = "Asia/Shanghai"
DEFAULT_MAX_COMPLETION_TOKENS_PER_REPLY = 2048
TOKEN_RESERVATION_TTL_SECONDS = 600

SETTING_KEYS = {
    "enabled": "ai_reply.enabled",
    "provider": "ai_reply.provider",
    "base_url": "ai_reply.base_url",
    "model": "ai_reply.model",
    "api_key": "ai_reply.api_key",
    "system_prompt": "ai_reply.system_prompt",
    "reasoning_effort": "ai_reply.reasoning_effort",
    "daily_token_limit": "ai_reply.daily_token_limit",
}
