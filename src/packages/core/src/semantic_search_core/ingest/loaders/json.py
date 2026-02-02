"""JSON file loader."""
import json
from typing import Any

from semantic_search_core.ingest.loaders.base import BaseLoader
from semantic_search_core.ingest.normalize import normalize_value


def _records_from_json(data: Any) -> list[dict[str, Any]]:
    """Extract records from JSON data."""
    if isinstance(data, list):
        if data and isinstance(data[0], dict):
            return [normalize_value(r) for r in data]
        return []
    if isinstance(data, dict):
        for key, val in data.items():
            if isinstance(val, list) and val and isinstance(val[0], dict):
                return [normalize_value(r) for r in val]
        return [normalize_value(data)]
    return []


class JSONLoader(BaseLoader):
    """Loader for JSON files."""

    name = "json"

    def detect(self, head: bytes, suffix: str) -> bool:
        if suffix != ".json":
            return False
        try:
            text = head.decode("utf-8", errors="replace").strip()
            return text.startswith("{") or text.startswith("[")
        except Exception:
            return False

    def load(self, file_path: str, options: dict) -> list[dict[str, Any]]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON parse error: {e}") from e

        records = _records_from_json(data)
        if not records:
            raise ValueError("JSON file has no array of objects or single object")

        out = []
        for r in records:
            if not isinstance(r, dict):
                continue
            flat = {}
            for k, v in r.items():
                if isinstance(v, (dict, list)) and not isinstance(v, str):
                    flat[k] = json.dumps(v) if v else ""
                else:
                    flat[k] = normalize_value(v)
            out.append(flat)
        return out
