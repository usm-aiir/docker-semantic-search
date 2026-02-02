"""Schema inference for uploaded files."""
from typing import Any

ID_LIKE_NAMES = {"id", "doc_id", "uuid", "_id", "document_id"}


def infer_suggested_id_field(columns: list[str]) -> str | None:
    """Infer which column might be an ID field."""
    for c in columns:
        if c.lower().strip() in ID_LIKE_NAMES:
            return c
    return None


def infer_suggested_text_fields(
    records: list[dict[str, Any]], columns: list[str], max_preview: int = 25
) -> list[str]:
    """Infer which columns might contain text content."""
    if not records or not columns:
        return []

    scored = []
    for col in columns:
        values = []
        for r in records[:max_preview]:
            v = r.get(col)
            if v is None:
                continue
            s = str(v).strip()
            if s:
                values.append(s)
        if not values:
            scored.append((col, 0))
            continue
        avg_len = sum(len(s) for s in values) / len(values)
        name_hint = (
            1
            if col.lower() in ("text", "body", "content", "description", "title", "name")
            else 0
        )
        score = avg_len * 0.01 + name_hint * 50
        scored.append((col, score))

    scored.sort(key=lambda x: -x[1])
    return [c for c, s in scored if s > 0][:5]
