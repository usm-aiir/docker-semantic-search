"""Job repository using SQLite."""
import os
import sqlite3
from contextlib import contextmanager
from typing import Any

import structlog

logger = structlog.get_logger()

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL,
    upload_id TEXT NOT NULL,
    status TEXT NOT NULL,
    total_records INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    error_sample TEXT,
    created_at TEXT,
    updated_at TEXT
);
"""


def _get_sqlite_path() -> str:
    return os.environ.get("SQLITE_PATH", "/data/jobs.db")


@contextmanager
def get_conn():
    """Get a database connection."""
    path = _get_sqlite_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Initialize the database."""
    with get_conn():
        pass


def upsert_job(
    job_id: str,
    collection_name: str,
    upload_id: str,
    status: str,
    total_records: int = 0,
    processed: int = 0,
    failed: int = 0,
    error_sample: str | None = None,
):
    """Insert or update a job."""
    import datetime

    now = datetime.datetime.utcnow().isoformat() + "Z"
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO jobs (job_id, collection_name, upload_id, status, total_records, processed, failed, error_sample, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                status = excluded.status,
                total_records = excluded.total_records,
                processed = excluded.processed,
                failed = excluded.failed,
                error_sample = excluded.error_sample,
                updated_at = excluded.updated_at
            """,
            (
                job_id,
                collection_name,
                upload_id,
                status,
                total_records,
                processed,
                failed,
                error_sample,
                now,
                now,
            ),
        )


def get_job(job_id: str) -> dict[str, Any] | None:
    """Get a job by ID."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM jobs WHERE job_id = ?", (job_id,)
        ).fetchone()
        if row is None:
            return None
        return dict(row)


def list_jobs_for_collection(collection_name: str) -> list[dict[str, Any]]:
    """List jobs for a collection."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM jobs WHERE collection_name = ? ORDER BY created_at DESC",
            (collection_name,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_active_jobs() -> list[dict[str, Any]]:
    """List all active (queued or processing) jobs."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM jobs WHERE status IN ('queued', 'processing') ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def list_recent_jobs(limit: int = 20) -> list[dict[str, Any]]:
    """List recent jobs (active first, then recent completed/failed)."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM jobs
            ORDER BY
                CASE status
                    WHEN 'processing' THEN 0
                    WHEN 'queued' THEN 1
                    ELSE 2
                END,
                updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def cancel_job(job_id: str) -> bool:
    """Mark a job as cancelled. Returns True if cancelled, False if job not found or not cancellable."""
    job = get_job(job_id)
    if not job or job["status"] not in ("queued", "processing"):
        return False
    upsert_job(
        job_id,
        job["collection_name"],
        job["upload_id"],
        "cancelled",
        total_records=job["total_records"] or 0,
        processed=job["processed"] or 0,
        failed=job["failed"] or 0,
        error_sample=job.get("error_sample"),
    )
    return True
