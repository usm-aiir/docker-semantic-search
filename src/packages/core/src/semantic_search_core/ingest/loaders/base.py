"""Base loader interface."""
from abc import ABC, abstractmethod
from typing import Any


class BaseLoader(ABC):
    """Abstract base class for file loaders."""

    name: str = ""

    @abstractmethod
    def detect(self, head: bytes, suffix: str) -> bool:
        """Detect if this loader can handle the file."""
        pass

    @abstractmethod
    def load(self, file_path: str, options: dict) -> list[dict[str, Any]]:
        """Load all records from the file."""
        pass

    def preview(self, file_path: str, options: dict, max_rows: int = 25) -> list[dict[str, Any]]:
        """Load a preview of records from the file."""
        return self.load(file_path, options)[:max_rows]
