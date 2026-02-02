"""File upload and preview endpoints."""
import os
from pathlib import Path

import structlog
from fastapi import APIRouter, File, UploadFile, HTTPException

from semantic_search_api.settings import get_settings
from semantic_search_core.ingest import detect_format, preview_records, get_loader
from semantic_search_core.ingest.infer import (
    infer_suggested_id_field,
    infer_suggested_text_fields,
)
from semantic_search_core.util import generate_id

router = APIRouter(prefix="/uploads", tags=["uploads"])
logger = structlog.get_logger()

UPLOAD_PATHS: dict[str, str] = {}


@router.post("/preview")
async def upload_preview(file: UploadFile = File(...)):
    """Upload a file and get a preview."""
    settings = get_settings()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413, detail=f"File too large (max {settings.max_upload_mb} MB)"
        )

    upload_id = generate_id()
    suffix = Path(file.filename or "").suffix.lower() or ".bin"
    os.makedirs(settings.upload_dir, exist_ok=True)
    save_path = os.path.join(settings.upload_dir, f"{upload_id}{suffix}")
    with open(save_path, "wb") as f:
        f.write(content)
    UPLOAD_PATHS[upload_id] = save_path

    detected = detect_format(save_path)
    if not detected:
        os.remove(save_path)
        UPLOAD_PATHS.pop(upload_id, None)
        raise HTTPException(
            status_code=400, detail="Unsupported or unrecognized file format"
        )

    try:
        preview = preview_records(save_path, detected, {}, max_rows=25)
    except ValueError as e:
        os.remove(save_path)
        UPLOAD_PATHS.pop(upload_id, None)
        raise HTTPException(status_code=400, detail=str(e)) from e

    if not preview:
        os.remove(save_path)
        UPLOAD_PATHS.pop(upload_id, None)
        raise HTTPException(status_code=400, detail="No records found in file")

    columns = list(preview[0].keys())
    suggested_text = infer_suggested_text_fields(preview, columns)
    suggested_id = infer_suggested_id_field(columns)

    return {
        "upload_id": upload_id,
        "detected_format": detected,
        "columns": columns,
        "preview_records": preview,
        "suggested_text_fields": suggested_text,
        "suggested_id_field": suggested_id,
    }


def get_upload_path(upload_id: str) -> str | None:
    """Get the path for an upload ID."""
    path = UPLOAD_PATHS.get(upload_id)
    if path and os.path.exists(path):
        return path
    settings = get_settings()
    for ext in [".csv", ".tsv", ".json", ".jsonl"]:
        p = os.path.join(settings.upload_dir, f"{upload_id}{ext}")
        if os.path.exists(p):
            return p
    return None
