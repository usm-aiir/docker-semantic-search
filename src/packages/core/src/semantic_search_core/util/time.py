"""Time utilities."""
from datetime import datetime


def utc_now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.utcnow().isoformat() + "Z"
