"""TSV file loader."""
import csv
from typing import Any

import pandas as pd

from semantic_search_core.ingest.loaders.base import BaseLoader
from semantic_search_core.ingest.normalize import normalize_record


class TSVLoader(BaseLoader):
    """Loader for TSV (tab-separated values) files."""

    name = "tsv"

    def detect(self, head: bytes, suffix: str) -> bool:
        if suffix != ".tsv":
            return False
        try:
            text = head.decode("utf-8", errors="replace")
            first_line = text.split("\n")[0]
            # TSV should have at least one tab in the header
            if "\t" not in first_line:
                return False
            list(csv.reader([first_line], delimiter="\t"))
            return True
        except Exception:
            return False

    def load(self, file_path: str, options: dict) -> list[dict[str, Any]]:
        try:
            df = pd.read_csv(
                file_path,
                sep="\t",
                dtype=str,
                keep_default_na=False,
                encoding="utf-8",
                on_bad_lines="skip",
            )
        except Exception as e:
            raise ValueError(f"TSV parse error: {e}") from e
        df = df.fillna("")
        records = df.to_dict("records")
        return [normalize_record(r) for r in records]
