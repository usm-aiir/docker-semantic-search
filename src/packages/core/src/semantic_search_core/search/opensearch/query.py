"""OpenSearch query operations."""
from opensearchpy import OpenSearch


def search_knn(
    client: OpenSearch,
    index_name: str,
    query_embedding: list[float],
    k: int = 10,
    filters: dict | None = None,
    size: int = 10,
) -> list[dict]:
    """Perform k-NN vector search."""
    knn_clause = {"knn": {"embedding": {"vector": query_embedding, "k": size}}}

    if filters:
        filter_clauses = []
        for key, value in filters.items():
            field = (
                f"metadata.{key}.keyword"
                if isinstance(value, str)
                else f"metadata.{key}"
            )
            filter_clauses.append({"term": {field: value}})
        body = {
            "size": size,
            "query": {"bool": {"must": [knn_clause], "filter": filter_clauses}},
        }
    else:
        body = {"size": size, "query": knn_clause}

    resp = client.search(index=index_name, body=body)
    hits = resp.get("hits", {}).get("hits", [])

    out = []
    for h in hits:
        s = h.get("_source", {})
        body_text = s.get("body", "") or ""
        snippet = body_text[:200] + ("..." if len(body_text) > 200 else "")
        out.append(
            {
                "doc_id": s.get("doc_id"),
                "title": s.get("title") or "",
                "snippet": snippet,
                "metadata": s.get("metadata", {}),
                "score": h.get("_score"),
                "body": body_text,
            }
        )
    return out
