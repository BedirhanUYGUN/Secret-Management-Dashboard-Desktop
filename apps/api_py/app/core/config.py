from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
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

    SUPABASE_AUTH_ENABLED: bool = False
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_AUTO_PROVISION_USERS: bool = False
    SUPABASE_DEFAULT_ROLE: str = "viewer"

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

    @field_validator("DATABASE_URL")
    @classmethod
    def required_values(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Required configuration is missing")
        return value

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("JWT_SECRET_KEY is required")
        if len(value.strip()) < 32:
            raise ValueError(
                "JWT_SECRET_KEY must be at least 32 characters for security"
            )
        return value

    @field_validator("SUPABASE_DEFAULT_ROLE")
    @classmethod
    def validate_supabase_default_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"admin", "member", "viewer"}:
            raise ValueError("SUPABASE_DEFAULT_ROLE must be admin, member or viewer")
        return normalized


@lru_cache()
def get_settings() -> Settings:
    return Settings()
