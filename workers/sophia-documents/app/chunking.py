import hashlib
import re
from typing import Any


def _words(text: str) -> list[str]:
    return re.findall(r"\S+", text.strip())


def chunk_blocks(blocks: list[Any], target_tokens: int = 950, overlap_tokens: int = 120) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current: list[str] = []
    current_page_start: int | None = None
    current_page_end: int | None = None
    current_heading: str | None = None
    order = 0

    def flush() -> None:
        nonlocal current, current_page_start, current_page_end, current_heading, order
        text = "\n".join(current).strip()
        if not text:
            return
        chunks.append({
            "text": text,
            "content": text,
            "page_start": current_page_start,
            "page_end": current_page_end,
            "heading": current_heading,
            "order_index": order,
            "content_hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "token_estimate": len(_words(text)),
        })
        order += 1
        tail = _words(text)[-overlap_tokens:]
        current = [" ".join(tail)] if tail else []
        current_page_start = current_page_end

    for block in blocks:
        text_value = getattr(block, "text", None)
        if text_value is None and isinstance(block, dict):
            text_value = block.get("text", "")
        text = str(text_value or "").strip()
        if not text:
            continue
        words = _words(text)
        page = getattr(block, "page_number", None)
        if page is None and isinstance(block, dict):
            page = block.get("page_number")
        heading = getattr(block, "heading", None)
        if heading is None and isinstance(block, dict):
            heading = block.get("heading")
        if page is not None:
            current_page_start = page if current_page_start is None else current_page_start
            current_page_end = page
        if heading and current_heading is None:
            current_heading = str(heading)
        current.extend(words)
        if len(_words(" ".join(current))) >= target_tokens:
            flush()
            current_heading = None
    flush()
    return chunks
