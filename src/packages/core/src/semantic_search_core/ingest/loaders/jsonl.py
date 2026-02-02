"""JSONL file loader."""
import json
from typing import Any

from semantic_search_core.ingest.loaders.base import BaseLoader
from semantic_search_core.ingest.normalize import normalize_value


class JSONLLoader(BaseLoader):
    """Loader for JSONL (newline-delimited JSON) files."""

    name = "jsonl"

    def detect(self, head: bytes, suffix: str) -> bool:
        if suffix not in (".jsonl", ".ndjson"):
            return False
        try:
            text = head.decode("utf-8", errors="replace").strip()
            if not text:
                return True
            json.loads(text.split("\n")[0])
            return True
        except Exception:
            return False

    def load(self, file_path: str, options: dict) -> list[dict[str, Any]]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"JSONL line {i + 1} parse error: {e}") from e
                if not isinstance(obj, dict):
                    continue
                flat = {}
                for k, v in obj.items():
                    if isinstance(v, (dict, list)) and not isinstance(v, str):
                        flat[k] = json.dumps(v) if v else ""
                    else:
                        flat[k] = normalize_value(v)
                records.append(flat)
        return records
