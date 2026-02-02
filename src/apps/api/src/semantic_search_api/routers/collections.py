"""Collection management endpoints."""
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semantic_search_core.search.opensearch import (
    get_client,
    safe_index_name,
    delete_index,
    ensure_index,
)

router = APIRouter(prefix="/collections", tags=["collections"])

DEFAULT_EMBED_DIM = 384


class CreateCollectionRequest(BaseModel):
    """Request to create a collection."""

    name: str = Field(..., min_length=1)


@router.get("")
def list_collections():
    """List all collections."""
    client = get_client()
    indices = client.cat.indices(index="collection_*", format="json")
    names = []
    for idx in indices:
        name = idx.get("index", "")
        if name.startswith("collection_"):
            names.append(name.replace("collection_", "").replace("_", " "))
    return {"collections": names}


@router.post("")
def create_collection(body: CreateCollectionRequest):
    """Create a new collection."""
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Collection name is required")
    safe = re.sub(r"[^a-zA-Z0-9 _-]", "", name).strip() or "default"
    client = get_client()
    ensure_index(client, safe, DEFAULT_EMBED_DIM)
    return {"name": safe, "message": "Collection created"}


@router.delete("/{name}")
def delete_collection(name: str):
    """Delete a collection."""
    safe = re.sub(r"[^a-zA-Z0-9 _-]", "", name).strip()
    if not safe:
        raise HTTPException(status_code=400, detail="Invalid collection name")
    client = get_client()
    delete_index(client, safe)
    return {"message": f"Collection {safe} deleted"}
