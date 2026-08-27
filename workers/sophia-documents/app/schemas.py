from dataclasses import dataclass, field
from typing import Any


@dataclass
class ExtractedPage:
    page_number: int
    text: str
    method: str
    confidence: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedBlock:
    text: str
    kind: str = "paragraph"
    order_index: int = 0
    page_number: int | None = None
    heading: str | None = None


@dataclass
class ExtractionResult:
    pages: list[ExtractedPage] = field(default_factory=list)
    blocks: list[ExtractedBlock] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    status: str = "concluido"
    method: str = "native"
    pages_ocr: int = 0

    @property
    def text(self) -> str:
        values = [page.text for page in self.pages if page.text.strip()]
        if not values:
            values = [block.text for block in self.blocks if block.text.strip()]
        return "\n\n".join(values).strip()
