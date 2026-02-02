"""FastAPI application entrypoint."""
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from semantic_search_api.logging import configure_logging
from semantic_search_api.routers import health, collections, uploads, jobs, search
from semantic_search_core.jobs import init_db

configure_logging()
logger = structlog.get_logger()

app = FastAPI(title="Semantic Search API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.on_event("startup")
def startup():
    """Initialize on startup."""
    logger.info("initializing_database")
    init_db()
    logger.info("preloading_embedding_model_this_may_take_a_minute")
    try:
        from semantic_search_core.embed import get_embedding_model

        get_embedding_model()
        logger.info("embedding_model_ready")
    except Exception as e:
        logger.warning("embedding_model_preload_failed", error=str(e))
