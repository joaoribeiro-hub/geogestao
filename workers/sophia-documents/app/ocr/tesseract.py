from ..schemas import ExtractedPage


def image_to_text(image, langs: str) -> tuple[str, float | None]:
    try:
        import pytesseract
        data = pytesseract.image_to_data(image, lang=langs, output_type=pytesseract.Output.DICT)
        values = [text.strip() for text in data.get("text", []) if text and text.strip()]
        confidences = [float(value) for value in data.get("conf", []) if str(value).strip() not in ("", "-1")]
        return " ".join(values), (sum(confidences) / len(confidences) / 100 if confidences else None)
    except Exception as exc:
        raise RuntimeError(f"OCR Tesseract indisponivel: {exc}") from exc


def ocr_image(image, langs: str) -> ExtractedPage:
    text, confidence = image_to_text(image, langs)
    return ExtractedPage(page_number=1, text=text, method="ocr", confidence=confidence)
