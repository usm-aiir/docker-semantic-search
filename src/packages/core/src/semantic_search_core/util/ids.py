"""ID generation utilities."""
import uuid


def generate_id() -> str:
    """Generate a unique ID."""
    return str(uuid.uuid4())
