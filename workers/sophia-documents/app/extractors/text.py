from pathlib import Path
from ..schemas import ExtractedBlock, ExtractionResult


def extract_text(buffer: bytes, filename: str) -> ExtractionResult:
    text = ""
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = buffer.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    block = ExtractedBlock(text=text, kind="paragraph", order_index=0)
    return ExtractionResult(blocks=[block], method="native", warnings=[f"formato={Path(filename).suffix.lower()}"])
