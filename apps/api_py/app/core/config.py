from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_ENV: str = "development"
    APP_NAME: str = "API Key Organizer API"
    API_PREFIX: str = ""

    DATABASE_URL: str = ""

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SECRET_ENCRYPTION_KEY: str = ""
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, value):
        def normalize(item: str) -> str:
            candidate = item.strip()
            if not candidate:
                return ""
            if candidate.startswith("http://") or candidate.startswith("https://"):
                return candidate
            return f"https://{candidate}"

        if isinstance(value, str):
            return [normalize(item) for item in value.split(",") if normalize(item)]
        return value

    @field_validator("DATABASE_URL", "JWT_SECRET_KEY")
    @classmethod
    def required_values(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Required configuration is missing")
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()
