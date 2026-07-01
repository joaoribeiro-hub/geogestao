from __future__ import annotations

from fastapi import BackgroundTasks, Depends, FastAPI

from app.models import AcceptedResponse, WorkerPayload
from app.process import process_selected, read_geometry, search_scenes
from app.security import require_worker_secret

app = FastAPI(title="GeoGestao BuscaGEO Worker", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/jobs/{job_id}/read-geometry", response_model=AcceptedResponse)
def read_geometry_endpoint(
    job_id: str,
    payload: WorkerPayload,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_worker_secret),
) -> AcceptedResponse:
    payload.job_id = job_id
    background_tasks.add_task(read_geometry, payload)
    return AcceptedResponse(message="Leitura de geometria recebida pelo worker.")


@app.post("/jobs/{job_id}/search-scenes", response_model=AcceptedResponse)
def search_scenes_endpoint(
    job_id: str,
    payload: WorkerPayload,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_worker_secret),
) -> AcceptedResponse:
    payload.job_id = job_id
    background_tasks.add_task(search_scenes, payload)
    return AcceptedResponse(message="Busca de cenas recebida pelo worker.")


@app.post("/jobs/{job_id}/process", response_model=AcceptedResponse)
def process_endpoint(
    job_id: str,
    payload: WorkerPayload,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_worker_secret),
) -> AcceptedResponse:
    payload.job_id = job_id
    background_tasks.add_task(process_selected, payload)
    return AcceptedResponse(message="Processamento de mosaico recebido pelo worker.")
