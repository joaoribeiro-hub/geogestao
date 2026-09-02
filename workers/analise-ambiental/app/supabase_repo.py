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

    def upsert_training_samples(self, samples: list[dict[str, Any]]) -> None:
        if samples:
            self.client.table("environmental_training_samples").upsert(
                samples,
                on_conflict="organization_id,job_id,fingerprint",
            ).execute()

    def find_recent_geotiff_for_aoi(self, organization_id: str, bbox: list[float]) -> dict[str, Any] | None:
        candidates: list[dict[str, Any]] = []
        try:
            documents = (
                self.client.table("documents")
                .select("id,storage_path,original_name,mime_type,created_at,metadata,external_metadata")
                .eq("organization_id", organization_id)
                .eq("upload_status", "enviado")
                .is_("deleted_at", "null")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            for row in documents.data or []:
                metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
                external = row.get("external_metadata") if isinstance(row.get("external_metadata"), dict) else {}
                module_key = str(metadata.get("module_key") or external.get("module_key") or "")
                document_bbox = metadata.get("bbox") or external.get("bbox")
                path = str(row.get("storage_path") or "")
                is_geotiff = path.lower().endswith((".tif", ".tiff", ".geotiff")) or "tiff" in str(row.get("mime_type") or "").lower()
                if is_geotiff and module_key in {"meuimovel", "meu-imovel-car", "buscageo"} and _bbox_intersects(bbox, document_bbox):
                    candidates.append({
                        **row,
                        "module_key": "meuimovel" if "imovel" in module_key else module_key,
                        "name": row.get("original_name") or Path(path).name,
                    })
        except Exception:
            # Compatibility: older deployments may not have document metadata columns yet.
            pass

        result = (
            self.client.table("module_buscageo_jobs")
            .select("id,output_storage_path,output_filename,bbox,created_at,finished_at")
            .eq("organization_id", organization_id)
            .eq("status", "done")
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        for row in result.data or []:
            path = str(row.get("output_storage_path") or "")
            candidate_bbox = row.get("bbox")
            if path and _bbox_intersects(bbox, candidate_bbox):
                candidates.append({
                    **row,
                    "module_key": "buscageo",
                    "storage_path": path,
                    "name": row.get("output_filename") or Path(path).name,
                })
        if not candidates:
            return None
        priority = {source: index for index, source in enumerate(self.settings.current_image_source_priority)}
        candidates.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        candidates.sort(key=lambda item: priority.get(str(item.get("module_key") or ""), 999))
        return candidates[0]

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


def _bbox_intersects(first: Any, second: Any) -> bool:
    if not isinstance(first, (list, tuple)) or not isinstance(second, (list, tuple)) or len(first) != 4 or len(second) != 4:
        return False
    a_min_x, a_min_y, a_max_x, a_max_y = (float(value) for value in first)
    b_min_x, b_min_y, b_max_x, b_max_y = (float(value) for value in second)
    return not (a_max_x < b_min_x or b_max_x < a_min_x or a_max_y < b_min_y or b_max_y < a_min_y)
