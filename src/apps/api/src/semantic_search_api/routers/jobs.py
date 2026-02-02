"""Index job endpoints."""
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from semantic_search_api.settings import get_settings
from semantic_search_api.routers.uploads import get_upload_path
from semantic_search_core.jobs import upsert_job, get_job, list_active_jobs, list_recent_jobs, cancel_job
from semantic_search_core.ingest import detect_format
from semantic_search_core.util import generate_id

router = APIRouter(prefix="/index", tags=["index"])
logger = structlog.get_logger()


def _quick_count_records(path: str, format_name: str) -> int:
    """Quick count of records without full parsing."""
    try:
        if format_name in ("csv", "tsv"):
            with open(path, "r", encoding="utf-8") as f:
                lines = sum(1 for _ in f)
            return max(0, lines - 1)  # Subtract header row
        elif format_name == "jsonl":
            with open(path, "r", encoding="utf-8") as f:
                return sum(1 for line in f if line.strip())
        elif format_name == "json":
            import json
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return len(data)
            if isinstance(data, dict):
                for val in data.values():
                    if isinstance(val, list):
                        return len(val)
                return 1
    except Exception:
        pass
    return 0


class IndexJobCreate(BaseModel):
    """Request to create an index job."""

    upload_id: str
    collection_name: str
    text_fields: list[str] = Field(..., min_length=1)
    title_field: str | None = None
    id_field: str | None = None
    metadata_fields: list[str] = Field(default_factory=list)


def _enqueue_or_run(job_id: str, payload: dict):
    """Enqueue job to RQ or run in background thread as fallback."""
    try:
        from redis import Redis
        from rq import Queue
        from semantic_search_worker.tasks import run_index_job

        conn = Redis.from_url(get_settings().redis_url)
        q = Queue("default", connection=conn)
        # Note: job_id must be in kwargs, not as a separate arg (RQ uses job_id= for its internal ID)
        q.enqueue(run_index_job, job_id, **payload, job_timeout="1h")
    except Exception as e:
        logger.warning("rq_enqueue_failed_running_in_thread", error=str(e))
        # Run in background thread so the API doesn't block
        import threading
        from semantic_search_worker.tasks import run_index_job

        def run_in_background():
            try:
                run_index_job(job_id=job_id, **payload)
            except Exception as sync_err:
                upsert_job(
                    job_id,
                    payload["collection_name"],
                    payload["upload_id"],
                    "failed",
                    0,
                    0,
                    0,
                    str(sync_err),
                )

        thread = threading.Thread(target=run_in_background, daemon=True)
        thread.start()


@router.post("/jobs")
def create_index_job(body: IndexJobCreate):
    """Start an indexing job."""
    path = get_upload_path(body.upload_id)
    if not path:
        raise HTTPException(
            status_code=404, detail="Upload not found or expired; please re-upload"
        )

    detected = detect_format(path)
    if not detected:
        raise HTTPException(status_code=400, detail="Could not detect file format")

    # Quick count without full parsing (worker will load the actual records)
    total_records = _quick_count_records(path, detected)

    job_id = generate_id()
    payload = {
        "collection_name": body.collection_name,
        "upload_id": body.upload_id,
        "file_path": path,
        "format_name": detected,
        "text_fields": body.text_fields,
        "title_field": body.title_field,
        "id_field": body.id_field,
        "metadata_fields": body.metadata_fields or [],
    }
    upsert_job(
        job_id,
        body.collection_name,
        body.upload_id,
        "queued",
        total_records=total_records,
        processed=0,
        failed=0,
    )
    _enqueue_or_run(job_id, payload)
    return {"job_id": job_id}


@router.get("/jobs")
def list_jobs(active_only: bool = False):
    """List jobs. If active_only=true, returns only queued/processing jobs."""
    if active_only:
        jobs = list_active_jobs()
    else:
        jobs = list_recent_jobs(limit=20)
    return {
        "jobs": [
            {
                "job_id": j["job_id"],
                "collection_name": j["collection_name"],
                "status": j["status"],
                "total_records": j["total_records"],
                "processed": j["processed"],
                "failed": j["failed"],
                "error_sample": j.get("error_sample"),
                "created_at": j.get("created_at"),
                "updated_at": j.get("updated_at"),
            }
            for j in jobs
        ]
    }


@router.post("/jobs/{job_id}/cancel")
def cancel_index_job(job_id: str):
    """Cancel a queued or processing job."""
    if not cancel_job(job_id):
        job = get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        raise HTTPException(
            status_code=400,
            detail=f"Job cannot be cancelled (status: {job['status']})",
        )
    return {"job_id": job_id, "status": "cancelled"}


@router.get("/jobs/{job_id}")
def get_index_job_status(job_id: str):
    """Get job status."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job["job_id"],
        "collection_name": job["collection_name"],
        "status": job["status"],
        "total_records": job["total_records"],
        "processed": job["processed"],
        "failed": job["failed"],
        "error_sample": job.get("error_sample"),
    }
