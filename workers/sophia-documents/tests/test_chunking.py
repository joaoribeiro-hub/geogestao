from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chunking import chunk_blocks
from app.classifier import classify
from app.schemas import ExtractedBlock


def test_chunking_preserves_order_and_hash():
    blocks = [ExtractedBlock(text="palavra " * 1200, page_number=2)]
    chunks = chunk_blocks(blocks, target_tokens=300, overlap_tokens=20)
    assert len(chunks) > 1
    assert [chunk["order_index"] for chunk in chunks] == list(range(len(chunks)))
    assert all(chunk["content_hash"] for chunk in chunks)


def test_classifier_uses_filename_and_text():
    assert classify("Contrato Fazenda.pdf", "",)[0] == "contrato"
    assert classify("arquivo.txt", "matricula 123")[0] == "matricula"
