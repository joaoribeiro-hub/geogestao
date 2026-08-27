from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    service_role_key: str
    worker_secret: str
    storage_bucket: str = "documentos"
    ocr_provider: str = "tesseract"
    ocr_langs: str = "por+eng"
    max_pages: int = 150
    max_file_mb: int = 50
    enable_gemini: bool = False
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"


def get_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        worker_secret=os.getenv("SOPHIA_DOCUMENT_WORKER_SECRET", "").strip(),
        storage_bucket=os.getenv("SOPHIA_DOCUMENT_STORAGE_BUCKET", "documentos").strip() or "documentos",
        ocr_provider=os.getenv("SOPHIA_DOCUMENT_OCR_PROVIDER", "tesseract").strip().lower(),
        ocr_langs=os.getenv("SOPHIA_DOCUMENT_OCR_LANGS", "por+eng").strip(),
        max_pages=int(os.getenv("SOPHIA_DOCUMENT_MAX_PAGES", "150")),
        max_file_mb=int(os.getenv("SOPHIA_DOCUMENT_MAX_FILE_MB", "50")),
        enable_gemini=os.getenv("SOPHIA_DOCUMENT_ENABLE_GEMINI", "false").lower() == "true",
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_AGENT_MODEL", "gemini-2.5-flash").strip(),
    )
