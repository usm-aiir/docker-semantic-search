"""Search type definitions."""
from typing import Any

from pydantic import BaseModel


class SearchResult(BaseModel):
    """A search result."""

    doc_id: str
    title: str
    snippet: str
    metadata: dict[str, Any]
    score: float | None
    body: str = ""
