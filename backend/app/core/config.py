import os
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = os.path.join(Path(__file__).resolve().parent.parent.parent.parent, ".env")


class Settings(BaseSettings):
    PROJECT_NAME: str = "LedgerSync AI"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ledgersync"
    READONLY_DATABASE_URL: str = (
        "postgresql://ledgersync_readonly:readonly_pass@localhost:5432/ledgersync"
    )
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    GEMINI_API_KEY: str = ""
    ENVIRONMENT: str = "development"
    SETTLEMENT_WINDOW_DAYS: int = 3
    SUBSET_SUM_TIMEOUT_MS: int = 200
    TOLERANCE_PAISE: int = 0
    CHUNK_SIZE: int = 100

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=ENV_PATH, env_file_encoding="utf-8", extra="ignore")


settings = Settings()
