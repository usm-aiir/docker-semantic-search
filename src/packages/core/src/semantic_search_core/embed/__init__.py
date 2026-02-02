"""Embedding module."""
from semantic_search_core.embed.model import get_embedding_model
from semantic_search_core.embed.chunk import chunk_text

__all__ = ["get_embedding_model", "chunk_text"]
