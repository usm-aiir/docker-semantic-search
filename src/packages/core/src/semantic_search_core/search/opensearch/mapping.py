"""OpenSearch index mapping configuration."""

KNN_ALGO_SPACE_TYPE = "l2"
KNN_ALGO_ENGINE = "nmslib"
KNN_M = 16
KNN_EF_CONSTRUCTION = 128
KNN_EF_SEARCH = 128


def get_index_mapping(embedding_dim: int) -> dict:
    """Get the OpenSearch index mapping for a collection."""
    return {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": KNN_EF_SEARCH,
                "number_of_shards": 1,
                "number_of_replicas": 0,
            }
        },
        "mappings": {
            "properties": {
                "doc_id": {"type": "keyword"},
                "collection": {"type": "keyword"},
                "title": {
                    "type": "text",
                    "fields": {"keyword": {"type": "keyword"}},
                },
                "body": {"type": "text"},
                "metadata": {"type": "object", "dynamic": True},
                "source_file": {"type": "keyword"},
                "row_number": {"type": "integer"},
                "created_at": {"type": "date"},
                "embedding": {
                    "type": "knn_vector",
                    "dimension": embedding_dim,
                    "method": {
                        "name": "hnsw",
                        "space_type": KNN_ALGO_SPACE_TYPE,
                        "engine": KNN_ALGO_ENGINE,
                        "parameters": {
                            "ef_construction": KNN_EF_CONSTRUCTION,
                            "m": KNN_M,
                        },
                    },
                },
            }
        },
    }
