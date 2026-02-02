"""Text chunking for embeddings."""

CHUNK_CHARS = 4000
CHUNK_OVERLAP = 200


def chunk_text(
    text: str, chunk_size: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """Split text into overlapping chunks."""
    if not text or len(text) <= chunk_size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if end < len(text):
            last_space = chunk.rfind(" ")
            if last_space > chunk_size // 2:
                end = start + last_space + 1
                chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap

    return chunks
