"""RQ worker entrypoint."""
import structlog
from redis import Redis
from rq import Worker

from semantic_search_worker.settings import get_redis_url
from semantic_search_worker.tasks import run_index_job  # noqa: F401

logger = structlog.get_logger()


def main():
    """Start the worker."""
    # Pre-load the embedding model at startup (before accepting jobs)
    # This avoids the 10-30s model load delay on the first job
    logger.info("preloading_embedding_model")
    from semantic_search_core.embed import get_embedding_model
    get_embedding_model()
    logger.info("embedding_model_ready")

    conn = Redis.from_url(get_redis_url())
    worker = Worker(["default"], connection=conn)
    worker.work()


if __name__ == "__main__":
    main()
