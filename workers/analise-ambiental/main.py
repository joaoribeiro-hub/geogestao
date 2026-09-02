from __future__ import annotations

from threading import Thread
import time

from fastapi import BackgroundTasks, Depends, FastAPI, Query

from app.config import get_settings
from app.models import AcceptedResponse, PollResponse
from app.providers.ana_hidrografia import AnaHidrografiaOficialProvider
from app.providers.car_provider import CarProvider
from app.providers.vegetation_model_provider import vegetation_model_catalog
from app.providers.current_image_provider import DynamicWorldProvider
from app.security import require_worker_secret

app = FastAPI(title="GeoGestao Analise Ambiental Worker", version="1.0.0")


@app.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "analise-ambiental",
        "worker": "analise-ambiental",
        "providers": {
            "mapbiomas": {
                "provider": settings.provider,
                "configured": bool(
                    settings.provider == "mapbiomas_gee"
                    and settings.mapbiomas_asset_id
                    and settings.gee_project_id
                    and (settings.gee_service_account_json_base64 or (settings.gee_service_account_email and settings.gee_private_key))
                ),
            },
            "hidrografia_oficial": {
                "provider": "ana_hidrografia_oficial",
                "configured": AnaHidrografiaOficialProvider(settings=settings).is_configured(),
                "source": "ANA/SNIRH BHO 6",
                "version": "6.2.4",
            },
            "car": {
                "provider": "car_manifest",
                "configured": CarProvider(settings=settings).is_configured(),
                "mode": settings.car_provider_mode,
                "manifest": bool(settings.car_source_manifest_url),
            },
            "current_image": {
                "provider": settings.vegetation_model_provider,
                "configured": settings.current_image_provider_enabled,
                "dynamic_world": DynamicWorldProvider(settings=settings, tmp_dir=settings.tmp_dir / "dynamic-world").is_configured(),
                "models": vegetation_model_catalog(settings),
            },
        },
    }


@app.post("/jobs/{job_id}/process", response_model=AcceptedResponse)
def process_job_endpoint(
    job_id: str,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_worker_secret),
) -> AcceptedResponse:
    from app.runner import process_job

    background_tasks.add_task(process_job, job_id)
    return AcceptedResponse(message="Processamento ambiental recebido pelo worker.")


@app.post("/jobs/poll", response_model=PollResponse)
def poll_jobs_endpoint(
    background_tasks: BackgroundTasks,
    limit: int = Query(default=3, ge=1, le=10),
    _: None = Depends(require_worker_secret),
) -> PollResponse:
    from app.supabase_repo import SupabaseJobRepository

    repo = SupabaseJobRepository()
    jobs = repo.list_pending_jobs(limit)
    job_ids = [str(job["id"]) for job in jobs]
    for job_id in job_ids:
        background_tasks.add_task(process_job, job_id)
    return PollResponse(accepted=len(job_ids), job_ids=job_ids)


def _poll_loop() -> None:
    from app.runner import process_pending_jobs

    settings = get_settings()
    while True:
        try:
            process_pending_jobs(settings.poll_limit)
        except Exception as exc:
            print(f"[analise-ambiental] polling error: {exc}")
        time.sleep(settings.poll_interval_seconds)


@app.on_event("startup")
def start_polling_loop() -> None:
    settings = get_settings()
    if settings.poll_enabled:
        Thread(target=_poll_loop, daemon=True).start()
