"""Record normalization utilities."""
from typing import Any

import pandas as pd


def normalize_value(v: Any) -> Any:
    """Normalize a value to JSON-serializable types."""
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, dict):
        return {str(k): normalize_value(x) for k, x in v.items()}
    if isinstance(v, list):
        return [normalize_value(x) for x in v]
    return str(v)


def normalize_record(row: dict) -> dict[str, Any]:
    """Normalize a record dict to JSON-serializable types."""
    out = {}
    for k, v in row.items():
        if v is None or (isinstance(v, float) and pd.isna(v)):
            out[k] = None
        elif isinstance(v, (int, float)):
            out[k] = v
        else:
            out[k] = str(v).strip() if v else ""
    return out
