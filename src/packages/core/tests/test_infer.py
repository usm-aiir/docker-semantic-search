"""Tests for schema inference."""
from semantic_search_core.ingest.infer import (
    infer_suggested_id_field,
    infer_suggested_text_fields,
)


def test_infer_id_field():
    assert infer_suggested_id_field(["name", "id", "text"]) == "id"
    assert infer_suggested_id_field(["doc_id", "body"]) == "doc_id"
    assert infer_suggested_id_field(["uuid", "title"]) == "uuid"
    assert infer_suggested_id_field(["title", "body"]) is None


def test_infer_text_fields():
    records = [
        {"id": "1", "title": "Short", "body": "This is a much longer piece of text content here."},
        {"id": "2", "title": "Also", "body": "Another long paragraph of content for the body field."},
    ]
    columns = ["id", "title", "body"]
    suggested = infer_suggested_text_fields(records, columns)
    assert "body" in suggested
    assert "title" in suggested
