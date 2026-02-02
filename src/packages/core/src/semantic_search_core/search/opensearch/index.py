"""OpenSearch index operations."""
import re
from datetime import datetime

import structlog
from opensearchpy import OpenSearch
from opensearchpy.helpers import bulk

from semantic_search_core.search.opensearch.mapping import get_index_mapping

logger = structlog.get_logger()


def safe_index_name(name: str) -> str:
    """Convert collection name to safe OpenSearch index name."""
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", name).strip("_") or "default"
    return f"collection_{safe}".lower()


def ensure_index(client: OpenSearch, collection_name: str, embedding_dim: int) -> str:
    """Ensure an index exists for a collection."""
    index_name = safe_index_name(collection_name)
    if not client.indices.exists(index=index_name):
        body = get_index_mapping(embedding_dim)
        client.indices.create(index=index_name, body=body)
        logger.info("created_index", index=index_name, collection=collection_name)
    return index_name


def delete_index(client: OpenSearch, collection_name: str) -> None:
    """Delete an index for a collection."""
    index_name = safe_index_name(collection_name)
    if client.indices.exists(index=index_name):
        client.indices.delete(index=index_name)
        logger.info("deleted_index", index=index_name, collection=collection_name)


def index_documents(
    client: OpenSearch, index_name: str, docs: list[dict]
) -> tuple[int, int]:
    """Bulk index documents."""
    # Format documents for helpers.bulk - embed _index and _id in each doc
    actions = []
    for doc in docs:
        action = {
            "_index": index_name,
            "_id": doc.get("doc_id", ""),
            **doc,  # Include all document fields
        }
        actions.append(action)

    try:
        success, failed = bulk(client, actions, raise_on_error=False, raise_on_exception=False)
        if failed:
            # Log the first few errors to help debugging
            sample_errors = failed[:3] if isinstance(failed, list) else []
            logger.warning(
                "bulk_index_errors",
                success=success,
                failed_count=len(failed) if isinstance(failed, list) else 0,
                sample_errors=sample_errors,
            )
        return success, len(failed) if isinstance(failed, list) else 0
    except Exception as e:
        logger.exception("bulk_index_exception", error=str(e), doc_count=len(docs))
        return 0, len(docs)


def build_doc(
    doc_id: str,
    collection: str,
    title: str,
    body: str,
    metadata: dict,
    source_file: str,
    row_number: int,
    embedding: list[float],
) -> dict:
    """Build a document for indexing."""
    return {
        "doc_id": doc_id,
        "collection": collection,
        "title": title or "",
        "body": body or "",
        "metadata": metadata or {},
        "source_file": source_file,
        "row_number": row_number,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "embedding": embedding,
    }
