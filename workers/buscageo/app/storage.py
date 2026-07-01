from __future__ import annotations

from pathlib import Path
from typing import Any
import json
import urllib.request

from supabase import create_client

from .settings import BUSCAGEO_STORAGE_BUCKET, BUSCAGEO_WORKER_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no worker BuscaGEO.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def download_to_path(storage_path: str, local_path: Path) -> Path:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    data = get_supabase().storage.from_(BUSCAGEO_STORAGE_BUCKET).download(storage_path)
    if isinstance(data, str):
        content = data.encode("utf-8")
    else:
        content = bytes(data)
    local_path.write_bytes(content)
    return local_path


def upload_file(local_path: Path, storage_path: str, content_type: str) -> str:
    options = {"content-type": content_type, "upsert": "true"}
    get_supabase().storage.from_(BUSCAGEO_STORAGE_BUCKET).upload(
        storage_path,
        local_path.read_bytes(),
        file_options=options,
    )
    return storage_path


def callback(callback_url: str | None, payload: dict[str, Any]) -> None:
    if not callback_url:
        return
    request = urllib.request.Request(
        callback_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {BUSCAGEO_WORKER_SECRET}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        response.read()
