from __future__ import annotations

from pathlib import Path
import os

WORKER_DIR = Path(__file__).resolve().parents[1]
TMP_DIR = Path(os.environ.get("BUSCAGEO_TMP_DIR", WORKER_DIR / "tmp"))
TMP_DIR.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUSCAGEO_WORKER_SECRET = os.environ.get("BUSCAGEO_WORKER_SECRET", "")
BUSCAGEO_STORAGE_BUCKET = os.environ.get("BUSCAGEO_STORAGE_BUCKET", "documentos")

URL_ROOT = "https://data.inpe.br/bdc/stac/v1/"
URL_SEARCH = "https://data.inpe.br/bdc/stac/v1/search"
CBERS_COLLECTION = os.environ.get("BUSCAGEO_CBERS_COLLECTION", "CB4A-WPM-PCA-FUSED-1")
DEFAULT_START_DATETIME = os.environ.get("BUSCAGEO_START_DATETIME", "2023-03-01T00:00:00Z")
MAX_PREVIEW_SCENES = int(os.environ.get("BUSCAGEO_MAX_PREVIEW_SCENES", "5"))
