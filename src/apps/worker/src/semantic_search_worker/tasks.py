"""Indexing task."""
import os

import structlog

from semantic_search_core.embed import get_embedding_model, chunk_text
from semantic_search_core.ingest import load_records, get_loader
from semantic_search_core.jobs import upsert_job, get_job
from semantic_search_core.search.opensearch import (
    get_client,
    ensure_index,
    index_documents,
    build_doc,
)
from semantic_search_core.util import generate_id

logger = structlog.get_logger()


def run_index_job(
    job_id: str,
    collection_name: str,
    upload_id: str,
    file_path: str,
    format_name: str,
    text_fields: list[str],
    title_field: str | None,
    id_field: str | None,
    metadata_fields: list[str],
) -> None:
    """Run an indexing job."""
    # Check if cancelled before starting (e.g. user cancelled while queued)
    job = get_job(job_id)
    if job and job.get("status") == "cancelled":
        return

    try:
        records = load_records(file_path, format_name, {})
    except Exception as e:
        upsert_job(job_id, collection_name, upload_id, "failed", 0, 0, 0, str(e))
        logger.exception("load_failed", job_id=job_id, error=str(e))
        return

    total = len(records)
    logger.info(
        "records_loaded",
        job_id=job_id,
        total=total,
        text_fields=text_fields,
        sample_keys=list(records[0].keys()) if records else [],
    )
    # Check again in case user cancelled while we were loading
    job = get_job(job_id)
    if job and job.get("status") == "cancelled":
        return

    upsert_job(
        job_id, collection_name, upload_id, "processing", total_records=total, processed=0, failed=0
    )

    model = get_embedding_model()
    dim = model.get_sentence_embedding_dimension()
    client = get_client()
    index_name = ensure_index(client, collection_name, dim)
    source_file = os.path.basename(file_path)

    processed = 0
    failed = 0
    error_sample = None
    batch = []
    BATCH_SIZE = 50

    for i, rec in enumerate(records):
        try:
            text_parts = []
            for f in text_fields:
                v = rec.get(f)
                if v is not None and str(v).strip():
                    text_parts.append(str(v).strip())
            body = " ".join(text_parts) or ""
            if not body:
                failed += 1
                if error_sample is None:
                    error_sample = f"Row {i + 1}: no text content (fields: {list(rec.keys())[:5]})"
                logger.warning(
                    "record_empty_body",
                    row=i + 1,
                    record_keys=list(rec.keys()),
                    text_fields=text_fields,
                )
                continue

            title = (rec.get(title_field) or "") if title_field else ""
            if isinstance(title, (int, float)):
                title = str(title)

            meta = {}
            if metadata_fields:
                for mf in metadata_fields:
                    if mf in rec and rec[mf] is not None:
                        meta[mf] = rec[mf]

            doc_id_raw = (rec.get(id_field) or "") if id_field else ""
            if not doc_id_raw:
                doc_id_raw = generate_id()

            chunks = chunk_text(body)
            for ci, chunk in enumerate(chunks):
                emb = model.encode(chunk, convert_to_numpy=True).tolist()
                doc_id = f"{doc_id_raw}_{ci}" if len(chunks) > 1 else doc_id_raw
                meta_chunk = dict(meta)
                if len(chunks) > 1:
                    meta_chunk["parent_id"] = doc_id_raw
                doc = build_doc(
                    doc_id=doc_id,
                    collection=collection_name,
                    title=title if ci == 0 else f"{title} (part {ci + 1})".strip(),
                    body=chunk,
                    metadata=meta_chunk,
                    source_file=source_file,
                    row_number=i + 1,
                    embedding=emb,
                )
                batch.append(doc)

            if len(batch) >= BATCH_SIZE:
                ok, err_count = index_documents(client, index_name, batch)
                processed += ok
                failed += err_count
                batch = []
                # Check for cancellation before continuing
                job = get_job(job_id)
                if job and job.get("status") == "cancelled":
                    upsert_job(
                        job_id,
                        collection_name,
                        upload_id,
                        "cancelled",
                        total_records=total,
                        processed=processed,
                        failed=failed,
                        error_sample=error_sample,
                    )
                    logger.info("job_cancelled", job_id=job_id, processed=processed)
                    return
                upsert_job(
                    job_id,
                    collection_name,
                    upload_id,
                    "processing",
                    total_records=total,
                    processed=processed,
                    failed=failed,
                    error_sample=error_sample,
                )

        except Exception as e:
            failed += 1
            if error_sample is None:
                error_sample = str(e)[:500]
            logger.warning("record_failed", row=i + 1, error=str(e))

    if batch:
        ok, err_count = index_documents(client, index_name, batch)
        processed += ok
        failed += err_count

    job = get_job(job_id)
    if job and job.get("status") == "cancelled":
        upsert_job(
            job_id,
            collection_name,
            upload_id,
            "cancelled",
            total_records=total,
            processed=processed,
            failed=failed,
            error_sample=error_sample,
        )
        logger.info("job_cancelled", job_id=job_id, processed=processed)
        return

    upsert_job(
        job_id,
        collection_name,
        upload_id,
        "completed",
        total_records=total,
        processed=processed,
        failed=failed,
        error_sample=error_sample,
    )
    logger.info("job_completed", job_id=job_id, processed=processed, failed=failed)
