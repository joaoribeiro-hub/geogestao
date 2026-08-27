from __future__ import annotations

from pathlib import Path
from typing import Any

from supabase import create_client

from .config import get_settings


class SupabaseJobRepository:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no worker Analise Ambiental.")
        self.settings = settings
        try:
            self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        except Exception as exc:
            raise RuntimeError(
                "Credenciais Supabase invalidas no worker Analise Ambiental. "
                "Confira SUPABASE_URL e use a SUPABASE_SERVICE_ROLE_KEY server-side do projeto, nao a anon/publishable key."
            ) from exc

    def get_job(self, job_id: str) -> dict[str, Any]:
        result = (
            self.client.table("module_environmental_analysis_jobs")
            .select("*")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            raise ValueError("Job ambiental nao encontrado.")
        return dict(rows[0])

    def list_pending_jobs(self, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.table("module_environmental_analysis_jobs")
            .select("*")
            .in_("status", ["worker_pendente", "worker_pending", "aguardando"])
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return [dict(row) for row in (result.data or [])]

    def update_job(self, job_id: str, payload: dict[str, Any]) -> None:
        self.client.table("module_environmental_analysis_jobs").update(payload).eq("id", job_id).execute()

    def replace_job_outputs(self, job_id: str, organization_id: str, outputs: list[dict[str, Any]]) -> None:
        self.client.table("environmental_analysis_outputs").delete().eq("job_id", job_id).eq(
            "organization_id", organization_id
        ).execute()
        if outputs:
            self.client.table("environmental_analysis_outputs").insert(outputs).execute()

    def download_to_path(self, storage_path: str, local_path: Path) -> Path:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        data = self.client.storage.from_(self.settings.storage_bucket).download(storage_path)
        if isinstance(data, str):
            content = data.encode("utf-8")
        else:
            content = bytes(data)
        local_path.write_bytes(content)
        return local_path

    def upload_bytes(self, content: bytes, storage_path: str, content_type: str) -> str:
        self.client.storage.from_(self.settings.storage_bucket).upload(
            storage_path,
            content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return storage_path
