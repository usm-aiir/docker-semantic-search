"""Job models."""
from pydantic import BaseModel


class JobStatus(BaseModel):
    """Job status response."""

    job_id: str
    status: str
    total_records: int
    processed: int
    failed: int
    error_sample: str | None = None
