from io import BytesIO
from ..ocr.tesseract import image_to_text
from ..schemas import ExtractedBlock, ExtractedPage, ExtractionResult


def extract_pdf(buffer: bytes, langs: str, max_pages: int) -> ExtractionResult:
    try:
        import fitz
    except Exception as exc:
        return ExtractionResult(status="erro", warnings=[f"PyMuPDF nao instalado: {exc}"])
    try:
        pdf = fitz.open(stream=buffer, filetype="pdf")
    except Exception as exc:
        return ExtractionResult(status="erro", warnings=[f"PDF invalido: {exc}"])

    pages: list[ExtractedPage] = []
    blocks: list[ExtractedBlock] = []
    warnings: list[str] = []
    pages_ocr = 0
    for index, page in enumerate(pdf, start=1):
        if index > max_pages:
            warnings.append(f"Limite de {max_pages} paginas aplicado.")
            break
        text = page.get_text("text").strip()
        method = "native"
        confidence = 1.0 if len(text) >= 40 else None
        if len(text) < 40:
            try:
                pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                from PIL import Image
                image = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
                text, confidence = image_to_text(image, langs)
                method = "mixed" if text else "ocr"
                pages_ocr += 1
            except Exception as exc:
                warnings.append(f"OCR falhou na pagina {index}: {exc}")
        pages.append(ExtractedPage(page_number=index, text=text, method=method, confidence=confidence))
        blocks.append(ExtractedBlock(text=text, kind="paragraph", order_index=index - 1, page_number=index))
    return ExtractionResult(pages=pages, blocks=blocks, warnings=warnings, method="mixed" if pages_ocr else "native", pages_ocr=pages_ocr)
