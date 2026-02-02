"""Embedding model management."""
import os
import structlog

logger = structlog.get_logger()

_embedding_model = None


def get_embedding_model():
    """Get or load the embedding model (cached)."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer

        model_name = os.environ.get(
            "EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        logger.info("loading_embedding_model", model=model_name)
        _embedding_model = SentenceTransformer(model_name)
    return _embedding_model
