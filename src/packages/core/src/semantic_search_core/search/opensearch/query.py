"""OpenSearch query operations."""
from opensearchpy import OpenSearch


def _parse_hits(hits: list[dict]) -> list[dict]:
    """Parse OpenSearch hits into result dictionaries."""
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


def _build_filter_clauses(filters: dict | None) -> list[dict]:
    """Build OpenSearch filter clauses from a filters dict."""
    if not filters:
        return []
    filter_clauses = []
    for key, value in filters.items():
        field = (
            f"metadata.{key}.keyword"
            if isinstance(value, str)
            else f"metadata.{key}"
        )
        filter_clauses.append({"term": {field: value}})
    return filter_clauses


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
    filter_clauses = _build_filter_clauses(filters)

    if filter_clauses:
        body = {
            "size": size,
            "query": {"bool": {"must": [knn_clause], "filter": filter_clauses}},
        }
    else:
        body = {"size": size, "query": knn_clause}

    resp = client.search(index=index_name, body=body)
    hits = resp.get("hits", {}).get("hits", [])
    return _parse_hits(hits)


def search_bm25(
    client: OpenSearch,
    index_name: str,
    query_text: str,
    filters: dict | None = None,
    size: int = 10,
) -> list[dict]:
    """Perform BM25 text search on title and body fields."""
    multi_match = {
        "multi_match": {
            "query": query_text,
            "fields": ["title^2", "body"],  # Boost title matches
            "type": "best_fields",
            "fuzziness": "AUTO",
        }
    }
    filter_clauses = _build_filter_clauses(filters)

    if filter_clauses:
        body = {
            "size": size,
            "query": {"bool": {"must": [multi_match], "filter": filter_clauses}},
        }
    else:
        body = {"size": size, "query": multi_match}

    resp = client.search(index=index_name, body=body)
    hits = resp.get("hits", {}).get("hits", [])
    return _parse_hits(hits)


def search_hybrid(
    client: OpenSearch,
    index_name: str,
    query_text: str,
    query_embedding: list[float],
    k: int = 10,
    filters: dict | None = None,
    vector_weight: float = 0.5,
    bm25_weight: float = 0.5,
) -> list[dict]:
    """
    Perform hybrid search combining BM25 and vector search with RRF.
    
    Uses Reciprocal Rank Fusion (RRF) to merge results:
    RRF(d) = sum(1 / (k + rank(d))) for each ranking
    """
    # Fetch more results for better fusion
    fetch_size = min(k * 3, 100)
    
    # Run both searches
    knn_results = search_knn(client, index_name, query_embedding, k=k, filters=filters, size=fetch_size)
    bm25_results = search_bm25(client, index_name, query_text, filters=filters, size=fetch_size)
    
    # RRF constant (typically 60)
    rrf_k = 60
    
    # Calculate RRF scores
    doc_scores: dict[str, float] = {}
    doc_data: dict[str, dict] = {}
    
    # Score from vector search
    for rank, doc in enumerate(knn_results, start=1):
        doc_id = doc["doc_id"]
        rrf_score = vector_weight * (1.0 / (rrf_k + rank))
        doc_scores[doc_id] = doc_scores.get(doc_id, 0) + rrf_score
        doc_data[doc_id] = doc
    
    # Score from BM25 search
    for rank, doc in enumerate(bm25_results, start=1):
        doc_id = doc["doc_id"]
        rrf_score = bm25_weight * (1.0 / (rrf_k + rank))
        doc_scores[doc_id] = doc_scores.get(doc_id, 0) + rrf_score
        if doc_id not in doc_data:
            doc_data[doc_id] = doc
    
    # Sort by RRF score and return top k
    sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)[:k]
    
    results = []
    for doc_id, score in sorted_docs:
        doc = doc_data[doc_id].copy()
        doc["score"] = score  # Replace original score with RRF score
        results.append(doc)
    
    return results
