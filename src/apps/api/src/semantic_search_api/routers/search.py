"""Search endpoint."""
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semantic_search_core.search.opensearch import get_client, safe_index_name, search_knn
from semantic_search_core.embed import get_embedding_model

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    """Search request."""

    collection_name: str
    query: str
    k: int = Field(default=10, ge=1, le=100)
    filters: dict[str, str | int | bool] | None = None


class SearchResultItem(BaseModel):
    """Search result item."""

    doc_id: str
    title: str
    snippet: str
    metadata: dict[str, Any]
    score: float | None
    body: str = ""


@router.post("", response_model=list[SearchResultItem])
def search(body: SearchRequest):
    """Perform semantic search."""
    client = get_client()
    index_name = safe_index_name(body.collection_name)
    if not client.indices.exists(index=index_name):
        raise HTTPException(
            status_code=404, detail=f"Collection not found: {body.collection_name}"
        )

    model = get_embedding_model()
    query_embedding = model.encode(body.query, convert_to_numpy=True).tolist()
    hits = search_knn(
        client,
        index_name,
        query_embedding,
        k=body.k,
        filters=body.filters,
        size=body.k,
    )
    return [SearchResultItem(**h) for h in hits]
