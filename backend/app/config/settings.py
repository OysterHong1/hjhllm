from pathlib import Path
from functools import lru_cache
import os


class Settings:
    def __init__(self) -> None:
        self.admin_api_token = os.getenv("ADMIN_API_TOKEN", "")
        self.database_url = os.getenv("DATABASE_URL", "")
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.ai_reply_token_usage_timezone = os.getenv(
            "AI_REPLY_TOKEN_USAGE_TIMEZONE", "Asia/Shanghai"
        )
        self.attachment_storage_dir = Path(
            os.getenv("ATTACHMENT_STORAGE_DIR", ".data/attachments")
        ).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
