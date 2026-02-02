"""API settings."""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    opensearch_url: str = "http://opensearch:9200"
    opensearch_username: str | None = None
    opensearch_password: str | None = None
    redis_url: str = "redis://redis:6379/0"
    sqlite_path: str = "/data/jobs.db"
    embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    max_upload_mb: int = 50
    upload_dir: str = "/tmp/uploads"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings."""
    return Settings()
