"""OpenSearch client and operations."""
from semantic_search_core.search.opensearch.client import get_client
from semantic_search_core.search.opensearch.mapping import get_index_mapping
from semantic_search_core.search.opensearch.index import (
    ensure_index,
    delete_index,
    index_documents,
    build_doc,
    safe_index_name,
)
from semantic_search_core.search.opensearch.query import search_knn

__all__ = [
    "get_client",
    "get_index_mapping",
    "ensure_index",
    "delete_index",
    "index_documents",
    "build_doc",
    "safe_index_name",
    "search_knn",
]
