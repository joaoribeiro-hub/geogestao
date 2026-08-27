from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from app.config import get_settings

app = FastAPI(title="GeoGestao Sophia Documents Worker", version="1.0.0")


def require_secret(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = f"Bearer {settings.worker_secret}"
    if not settings.worker_secret or authorization != expected:
        raise HTTPException(status_code=401, detail="Worker authorization invalid")


@app.get("/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "sophia-documents",
        "worker": "sophia-documents",
        "ocr_provider": settings.ocr_provider,
        "configured": bool(settings.supabase_url and settings.service_role_key and settings.worker_secret),
        "gemini_enabled": bool(settings.enable_gemini and settings.gemini_api_key),
    }


@app.post("/documents/{document_id}/ingest")
def ingest_document(document_id: str, background_tasks: BackgroundTasks, _: None = Depends(require_secret)) -> dict[str, object]:
    from app.runner import process_source
    print(f"[sophia-documents] ingestao recebida: document_id={document_id}", flush=True)
    background_tasks.add_task(process_source, "document", document_id)
    return {"accepted": True, "status": "processing", "document_id": document_id}


@app.post("/inbox/{inbox_item_id}/ingest")
def ingest_inbox(inbox_item_id: str, background_tasks: BackgroundTasks, _: None = Depends(require_secret)) -> dict[str, object]:
    from app.runner import process_source
    print(f"[sophia-documents] ingestao recebida: inbox_item_id={inbox_item_id}", flush=True)
    background_tasks.add_task(process_source, "inbox", inbox_item_id)
    return {"accepted": True, "status": "processing", "inbox_item_id": inbox_item_id}


@app.post("/jobs/poll")
def poll_jobs(_: None = Depends(require_secret)) -> dict[str, object]:
    # Polling is intentionally explicit; a scheduler can call this endpoint later.
    return {"accepted": 0, "message": "Use a fila externa ou acione a ingestao por documento/inbox."}
