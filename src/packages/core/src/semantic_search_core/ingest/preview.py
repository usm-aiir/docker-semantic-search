"""File preview and format detection."""
from pathlib import Path
from typing import Any

from semantic_search_core.ingest.loaders import CSVLoader, TSVLoader, JSONLoader, JSONLLoader

LOADERS = [JSONLLoader(), JSONLoader(), CSVLoader(), TSVLoader()]


def detect_format(file_path: str) -> str | None:
    """Detect the format of a file."""
    path = Path(file_path)
    if not path.exists():
        return None
    with open(file_path, "rb") as f:
        head = f.read(8192)
    for loader in LOADERS:
        if loader.detect(head, path.suffix.lower()):
            return loader.name
    return None


def get_loader(format_name: str):
    """Get a loader by format name."""
    for loader in LOADERS:
        if loader.name == format_name:
            return loader
    raise ValueError(f"Unknown format: {format_name}")


def preview_records(
    file_path: str, format_name: str, options: dict | None = None, max_rows: int = 25
) -> list[dict[str, Any]]:
    """Load a preview of records from a file."""
    loader = get_loader(format_name)
    return loader.preview(file_path, options or {}, max_rows=max_rows)


def load_records(
    file_path: str, format_name: str, options: dict | None = None
) -> list[dict[str, Any]]:
    """Load all records from a file."""
    loader = get_loader(format_name)
    return loader.load(file_path, options or {})
