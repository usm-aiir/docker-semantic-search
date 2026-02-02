"""Worker settings."""
import os


def get_redis_url() -> str:
    """Get Redis URL from environment."""
    return os.environ.get("REDIS_URL", "redis://redis:6379/0")
