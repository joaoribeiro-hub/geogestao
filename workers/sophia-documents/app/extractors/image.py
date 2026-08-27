from io import BytesIO
from ..ocr.tesseract import ocr_image
from ..schemas import ExtractedBlock, ExtractedPage, ExtractionResult


def extract_image(buffer: bytes, langs: str) -> ExtractionResult:
    try:
        from PIL import Image, ImageOps
        image = ImageOps.exif_transpose(Image.open(BytesIO(buffer)).convert("RGB"))
        max_dimension = 2400
        if max(image.size) > max_dimension:
            image.thumbnail((max_dimension, max_dimension))
        page = ocr_image(image, langs)
        return ExtractionResult(
            pages=[page],
            blocks=[ExtractedBlock(text=page.text, order_index=0, page_number=1)],
            method="ocr",
            pages_ocr=1,
        )
    except Exception as exc:
        return ExtractionResult(status="erro", method="ocr", warnings=[str(exc)])
