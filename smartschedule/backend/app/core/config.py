"""
SmartSchedule — Application Settings
Reads configuration from environment variables / .env file.
"""
from typing import Any
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ─── App ───
    PROJECT_NAME: str = "SEC SchedX API"
    ENVIRONMENT: str = "development"  # development | staging | production

    # ─── Database ───
    DATABASE_URL: str = "sqlite+aiosqlite:///./smartschedule.db"

    # ─── Supabase ───
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ─── JWT ───
    JWT_SECRET: str = "sm4rtsch3dule-dev-secret-key-2026-do-not-use-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # ─── AI (Gemini) ───
    AI_API_KEY: str | None = None
    AI_MODEL: str = "gemini-1.5-pro"

    # ─── Firebase / FCM ───
    FCM_SERVER_KEY: str | None = None
    FCM_PROJECT_ID: str | None = None

    # ─── Redis (background jobs) ───
    REDIS_URL: str = "redis://localhost:6379"

    # ─── CORS ───
    CORS_ORIGINS: list[str] | str = ["http://localhost:3000", "http://localhost:3001"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        if isinstance(v, list):
            return v
        return [v]

    @model_validator(mode="after")
    def reject_insecure_production_defaults(self):
        if self.ENVIRONMENT.lower() == "production":
            if self.JWT_SECRET == "sm4rtsch3dule-dev-secret-key-2026-do-not-use-in-prod":
                raise ValueError("JWT_SECRET must be configured securely in production")
            if not self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS must be configured in production")
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
